"""
Tarini CLI — development entry point for rapid testing and system prompt iteration.

Usage:
  cd backend
  python main.py

On first run: creates a new Supabase session and saves the session ID to .tarini_session.
On subsequent runs: loads the session ID and resumes the conversation.

To start fresh: delete the .tarini_session file.
"""
import asyncio
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from claude_agent_sdk import AssistantMessage, ClaudeSDKClient, ResultMessage, TextBlock

from tarini.agent import build_options
from tarini.db import client as db
from tarini.prompts import INITIAL_PROMPT

SESSION_FILE = Path(".tarini_session")


async def load_or_create_session() -> dict:
    """Load session from file, or create a new one and save the ID."""
    if SESSION_FILE.exists():
        session_id = SESSION_FILE.read_text().strip()
        session = await db.get_session(session_id)
        if session:
            print(f"[Resuming session: {session_id[:8]}...]")
            return session
        else:
            print("[Session not found in database — starting fresh]")

    session = await db.create_session()
    SESSION_FILE.write_text(session["id"])
    print(f"[New session: {session['id'][:8]}...]")
    return session


def print_tarini(text: str) -> None:
    """Print Tarini's response with a label."""
    print(f"\nTarini: {text}", end="", flush=True)


async def run_turn(
    client: ClaudeSDKClient,
    message: str,
    session: dict,
) -> str | None:
    """
    Send a message, stream the response, and return the SDK session_id
    from the ResultMessage (if received for the first time).
    """
    await client.query(message)
    captured_sdk_id: str | None = None
    printed = False

    async for msg in client.receive_response():
        if isinstance(msg, AssistantMessage):
            for block in msg.content:
                if isinstance(block, TextBlock) and block.text:
                    if not printed:
                        print()  # newline before first chunk
                        printed = True
                    print_tarini(block.text)
        elif isinstance(msg, ResultMessage):
            captured_sdk_id = msg.session_id

    if printed:
        print()  # trailing newline

    return captured_sdk_id


async def main() -> None:
    session = await load_or_create_session()
    session_id = session["id"]
    sdk_session_id = session.get("sdk_session_id") or None

    options = build_options(session_id=session_id, sdk_session_id=sdk_session_id)

    print("\n" + "=" * 60)
    print("  Tarini — RentOK Property Onboarding")
    print("  Type 'exit' or 'quit' to end. 'new' to start over.")
    print("=" * 60)

    async with ClaudeSDKClient(options=options) as client:
        # Opening — Tarini checks state and greets
        sdk_id = await run_turn(client, INITIAL_PROMPT, session)
        if sdk_id and not sdk_session_id:
            await db.update_sdk_session_id(session_id, sdk_id)
            sdk_session_id = sdk_id

        # Chat loop
        while True:
            try:
                user_input = input("\nYou: ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n\nGoodbye!")
                break

            if not user_input:
                continue

            if user_input.lower() in ("exit", "quit", "bye"):
                print("\nTarini: Your progress is saved. See you next time!")
                break

            if user_input.lower() == "new":
                confirm = input("Start over? This will clear all saved data. (yes/no): ").strip()
                if confirm.lower() == "yes":
                    SESSION_FILE.unlink(missing_ok=True)
                    print("Starting fresh. Please restart the CLI.")
                    break
                else:
                    print("Okay, continuing where we left off.")
                    continue

            await run_turn(client, user_input, session)


if __name__ == "__main__":
    asyncio.run(main())
