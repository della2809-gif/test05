"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { ChevronDown, X } from "lucide-react";

interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  tableName?: string;
}

function loadLocalCategories(tableName: string): string[] {
  try {
    const raw = localStorage.getItem(`admin_extra_categories_${tableName}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CategoryCombobox({
  value,
  onChange,
  options,
  placeholder = "카테고리 선택 또는 입력",
  className,
  tableName,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  const allOptions = tableName
    ? [...new Set([...options, ...loadLocalCategories(tableName)])]
    : options;
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // 드롭다운 위치 계산 (portal용)
  function updateDropdownPosition() {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }

  useEffect(() => {
    if (!open) return;
    updateDropdownPosition();

    const handleScroll = () => updateDropdownPosition();
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const dropdown = document.getElementById("category-combobox-portal");
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !dropdown?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 현재 값이 allOptions에 정확히 일치하면 → 전체 목록(자기 자신 제외) 표시
  // 타이핑 중이면 → 입력값으로 필터
  const filtered = (() => {
    if (!inputValue) return allOptions;
    if (allOptions.includes(inputValue)) {
      return allOptions.filter((opt) => opt !== inputValue);
    }
    return allOptions.filter((opt) =>
      opt.toLowerCase().includes(inputValue.toLowerCase())
    );
  })();

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setInputValue(v);
    if (!composingRef.current) {
      onChange(v);
    }
    setOpen(true);
  }

  function handleSelect(opt: string) {
    setInputValue(opt);
    onChange(opt);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setInputValue("");
    onChange("");
    inputRef.current?.focus();
  }

  function handleFocus() {
    updateDropdownPosition();
    setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter" && filtered.length === 1) {
      handleSelect(filtered[0]);
    }
  }

  const isNewCategory = open && inputValue && !allOptions.includes(inputValue) && filtered.length === 0;
  const showDropdown = open;

  const dropdownContent = (
    <div
      id="category-combobox-portal"
      style={dropdownStyle}
      className="rounded-lg border border-border bg-background shadow-lg overflow-hidden"
    >
      {filtered.length > 0 ? (
        <ul className="max-h-48 overflow-y-auto py-1">
          {filtered.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(opt);
                }}
                className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover transition-colors"
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      ) : isNewCategory ? (
        <p className="px-3 py-2 text-xs text-foreground-tertiary">
          &ldquo;{inputValue}&rdquo; 새 카테고리로 저장됩니다
        </p>
      ) : (
        <p className="px-3 py-2 text-xs text-foreground-tertiary">
          등록된 카테고리가 없습니다. 직접 입력할 수 있습니다.
        </p>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={(e) => {
            composingRef.current = false;
            const v = (e.target as HTMLInputElement).value;
            setInputValue(v);
            onChange(v);
          }}
          placeholder={placeholder}
          className={cn(
            "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 pr-16 text-sm",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "transition-colors"
          )}
        />
        <div className="absolute right-0 flex items-center pr-2 gap-0.5">
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-0.5 text-foreground-tertiary hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (open) {
                setOpen(false);
              } else {
                handleFocus();
              }
            }}
            className="rounded p-0.5 text-foreground-tertiary hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                open && "rotate-180"
              )}
            />
          </button>
        </div>
      </div>

      {showDropdown &&
        typeof window !== "undefined" &&
        createPortal(dropdownContent, document.body)}
    </div>
  );
}
