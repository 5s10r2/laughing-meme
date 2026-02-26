"use client";

import { PartyPopper, CheckCircle2, LayoutDashboard, Camera } from "lucide-react";
import { cn } from "../../../lib/cn";
import { motion } from "framer-motion";

interface PropertyStats {
  propertyName: string;
  totalFloors: number;
  totalRooms: number;
  totalPackages: number;
  propertyType?: string;
  location?: string;
}

interface CompletionCelebrationProps {
  stats: PropertyStats;
  onSendMessage?: (text: string) => void;
}

export function CompletionCelebration({
  stats: rawStats,
  onSendMessage,
  ...rest
}: CompletionCelebrationProps & Record<string, unknown>) {
  // Defensive: Claude may send stats fields as top-level props or with different names
  const s = (rawStats && typeof rawStats === "object" ? rawStats : {}) as Record<string, unknown>;
  const stats: PropertyStats = rawStats && typeof rawStats === "object"
    ? {
        propertyName: (s.propertyName || s.property_name || "Your Property") as string,
        totalFloors: (s.totalFloors || s.total_floors || 0) as number,
        totalRooms: (s.totalRooms || s.total_rooms || 0) as number,
        totalPackages: (s.totalPackages || s.total_packages || 0) as number,
        propertyType: (s.propertyType || s.property_type) as string | undefined,
        location: s.location as string | undefined,
      }
    : {
        // Fallback: try extracting from top-level props
        propertyName: (rest.propertyName || rest.property_name || rest.name || "Your Property") as string,
        totalFloors: (rest.totalFloors || rest.total_floors || rest.floors || 0) as number,
        totalRooms: (rest.totalRooms || rest.total_rooms || rest.rooms || 0) as number,
        totalPackages: (rest.totalPackages || rest.total_packages || rest.packages || 0) as number,
        propertyType: (rest.propertyType || rest.property_type) as string | undefined,
        location: rest.location as string | undefined,
      };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="border border-emerald-500/25 bg-gradient-to-b from-emerald-500/10 to-zinc-900/30 rounded-xl px-5 py-5 my-2"
    >
      {/* Success Icon */}
      <div className="flex flex-col items-center text-center mb-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3"
        >
          <CheckCircle2 className="w-7 h-7 text-emerald-400" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-1.5 justify-center mb-1">
            <PartyPopper className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-zinc-100">
              Setup Complete!
            </h3>
            <PartyPopper className="w-4 h-4 text-amber-400 scale-x-[-1]" />
          </div>
          <p className="text-xs text-zinc-400">
            {stats.propertyName} is ready to go live
          </p>
        </motion.div>
      </div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-3 gap-2 mb-4"
      >
        <div className="text-center py-2 px-2 rounded-lg bg-zinc-800/40">
          <p className="text-lg font-bold text-zinc-200">{stats.totalFloors}</p>
          <p className="text-[10px] text-zinc-500">
            Floor{stats.totalFloors !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="text-center py-2 px-2 rounded-lg bg-zinc-800/40">
          <p className="text-lg font-bold text-zinc-200">{stats.totalRooms}</p>
          <p className="text-[10px] text-zinc-500">
            Room{stats.totalRooms !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="text-center py-2 px-2 rounded-lg bg-zinc-800/40">
          <p className="text-lg font-bold text-zinc-200">
            {stats.totalPackages}
          </p>
          <p className="text-[10px] text-zinc-500">
            Package{stats.totalPackages !== 1 ? "s" : ""}
          </p>
        </div>
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex gap-2"
      >
        <button
          onClick={() => onSendMessage?.("Take me to the dashboard")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium",
            "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
            "hover:bg-emerald-500/30 active:scale-95 transition-all"
          )}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          View Dashboard
        </button>
        <button
          onClick={() => onSendMessage?.("I want to add photos")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium",
            "text-zinc-400 border border-zinc-700",
            "hover:bg-zinc-800 active:scale-95 transition-all"
          )}
        >
          <Camera className="w-3.5 h-3.5" />
          Add Photos
        </button>
      </motion.div>
    </motion.div>
  );
}
