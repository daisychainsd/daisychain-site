"use client";

import { useState } from "react";

interface EventsToggleProps {
  upcomingCount: number;
  pastCount: number;
}

export default function EventsToggle({ upcomingCount, pastCount }: EventsToggleProps) {
  const [active, setActive] = useState<"upcoming" | "past">(
    upcomingCount > 0 ? "upcoming" : "past"
  );

  const scrollTo = (id: string, tab: "upcoming" | "past") => {
    setActive(tab);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="container-toggle">
      {upcomingCount > 0 && (
        <button
          onClick={() => scrollTo("upcoming", "upcoming")}
          className={`container-toggle-option px-5 py-2 text-sm toggle-first ${
            active === "upcoming" ? "toggle-active" : ""
          }`}
        >
          Upcoming
        </button>
      )}
      {pastCount > 0 && (
        <button
          onClick={() => scrollTo("past", "past")}
          className={`container-toggle-option px-5 py-2 text-sm ${
            upcomingCount === 0 ? "toggle-first" : "toggle-last"
          } ${active === "past" ? "toggle-active" : ""}`}
        >
          Past
        </button>
      )}
    </div>
  );
}
