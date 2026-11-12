"use client";

import type { ReactNode } from "react";
import { RoomProvider } from "@/client/room";
import { RoomShell } from "@/components/room/RoomShell";

/** Everything under this layout belongs to a private room and stays in sync with the server. */
export default function RoomLayout({ children }: { children: ReactNode }) {
  return (
    <RoomProvider>
      <RoomShell>{children}</RoomShell>
    </RoomProvider>
  );
}
