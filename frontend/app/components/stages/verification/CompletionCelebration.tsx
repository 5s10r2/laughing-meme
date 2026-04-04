"use client";

import { Check, ArrowRight } from "lucide-react";
import { cn } from "../../../lib/cn";
import {
  CARD, BTN_PRIMARY, BTN_SECONDARY,
} from "../../ui/primitives";
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
        propertyName: (s.propertyName || s.property_name || s.name || "Your Property") as string,
        totalFloors: Number(s.totalFloors ?? s.total_floors ?? s.floors ?? s.floor_count ?? 0),
        totalRooms: Number(s.totalRooms ?? s.total_rooms ?? s.rooms ?? s.room_count ?? s.units ?? 0),
        totalPackages: Number(s.totalPackages ?? s.total_packages ?? s.packages ?? s.package_count ?? 0),
        propertyType: (s.propertyType || s.property_type) as string | undefined,
        location: s.location as string | undefined,
      }
    : {
        // Fallback: try extracting from top-level props
        propertyName: (rest.propertyName || rest.property_name || rest.name || "Your Property") as string,
        totalFloors: Number(
          (rest.totalFloors ?? rest.total_floors ?? rest.floors ?? rest.floor_count ?? 0) as number
        ),
        totalRooms: Number(
          (rest.totalRooms ?? rest.total_rooms ?? rest.rooms ?? rest.room_count ?? rest.units ?? 0) as number
        ),
        totalPackages: Number(
          (rest.totalPackages ?? rest.total_packages ?? rest.packages ?? rest.package_count ?? 0) as number
        ),
        propertyType: (rest.propertyType || rest.property_type) as string | undefined,
        location: rest.location as string | undefined,
      };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(CARD, "text-center py-8")}
    >
      {/* Success Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="w-14 h-14 rounded-full bg-success/12 flex items-center justify-center mx-auto mb-4"
      >
        <Check className="w-7 h-7 text-success" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="text-lg font-bold text-content mb-1">
          You&apos;re all set!
        </h3>
        <p className="text-sm text-content-secondary mb-6">
          {stats.propertyName} is ready to go live on RentOk
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-3 gap-3 mb-6"
      >
        {[
          { value: stats.totalFloors, label: `Floor${stats.totalFloors !== 1 ? "s" : ""}` },
          { value: stats.totalRooms, label: `Room${stats.totalRooms !== 1 ? "s" : ""}` },
          { value: stats.totalPackages, label: `Package${stats.totalPackages !== 1 ? "s" : ""}` },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 + i * 0.1, duration: 0.3, ease: "easeOut" }}
            className="py-3 rounded-xl bg-bg-elevated"
          >
            <p className="text-xl font-bold text-content">{stat.value}</p>
            <p className="text-[11px] text-content-tertiary mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="space-y-2.5"
      >
        <button
          onClick={() => onSendMessage?.("Take me to the dashboard")}
          className={BTN_PRIMARY}
        >
          <span className="inline-flex items-center gap-2">
            Go to dashboard <ArrowRight className="w-4 h-4" />
          </span>
        </button>
        <button
          onClick={() => onSendMessage?.("I want to add photos")}
          className={cn(BTN_SECONDARY, "w-full")}
        >
          Add property photos
        </button>
      </motion.div>
    </motion.div>
  );
}
