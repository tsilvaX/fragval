"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Friend } from "@/lib/model";
import { PlayerName } from "./primitives";

export function PlayerFilter({
  friends,
  value,
  onChange,
}: {
  friends: Friend[];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const options = [
    { id: "all", friend: undefined },
    ...friends.map((friend) => ({ id: friend.id, friend })),
  ];
  const selected = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );
  const choose = (index: number) => {
    onChange(options[index].id);
    setOpen(false);
  };
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  return (
    <div
      className="player-filter"
      ref={container}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <span id={`${id}-label`}>Player</span>
      <div className="player-picker">
        <button
          type="button"
          role="combobox"
          aria-labelledby={`${id}-label`}
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-haspopup="listbox"
          aria-activedescendant={open ? `${id}-option-${active}` : undefined}
          onClick={() => {
            setActive(selected);
            setOpen((wasOpen) => !wasOpen);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              if (open) event.stopPropagation();
              setOpen(false);
              return;
            }
            if (event.key === "Tab") {
              setOpen(false);
              return;
            }
            if (
              !["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(
                event.key,
              )
            )
              return;
            event.preventDefault();
            if (event.key === "Enter" || event.key === " ") {
              if (open) choose(active);
              else {
                setActive(selected);
                setOpen(true);
              }
              return;
            }
            const current = open ? active : selected;
            setActive(
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? options.length - 1
                  : (current +
                      (event.key === "ArrowUp" ? -1 : 1) +
                      options.length) %
                    options.length,
            );
            setOpen(true);
          }}
        >
          {options[selected].friend ? (
            <PlayerName friend={options[selected].friend!} />
          ) : (
            <span>All friends</span>
          )}
          <ChevronDown size={12} aria-hidden="true" />
        </button>
        {open && (
          <div
            className="player-options"
            id={`${id}-options`}
            role="listbox"
            aria-labelledby={`${id}-label`}
          >
            {options.map((option, index) => (
              <button
                type="button"
                role="option"
                id={`${id}-option-${index}`}
                key={option.id}
                aria-selected={value === option.id}
                tabIndex={-1}
                data-active={index === active}
                onPointerMove={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
              >
                {option.friend ? (
                  <PlayerName friend={option.friend} />
                ) : (
                  "All friends"
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
