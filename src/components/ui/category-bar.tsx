"use client";

import { useState, useEffect } from "react";
import { Plus, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface CategoryBarProps {
  categories: string[];
  activeFilter: string | null;
  onFilterChange: (cat: string | null) => void;
  tableName: string;
  onCategoriesChange: () => void;
}

function getLocalKey(tableName: string) {
  return `admin_extra_categories_${tableName}`;
}

function loadLocalCategories(tableName: string): string[] {
  try {
    const raw = localStorage.getItem(getLocalKey(tableName));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalCategories(tableName: string, cats: string[]) {
  try {
    localStorage.setItem(getLocalKey(tableName), JSON.stringify(cats));
  } catch {}
}

export function CategoryBar({
  categories,
  activeFilter,
  onFilterChange,
  tableName,
  onCategoriesChange,
}: CategoryBarProps) {
  const [manageOpen, setManageOpen] = useState(false);
  const [categoryEdits, setCategoryEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [extraCategories, setExtraCategories] = useState<string[]>([]);

  useEffect(() => {
    const loaded = loadLocalCategories(tableName);
    setExtraCategories(loaded);
  }, [tableName]);

  const allCategories = [...new Set([...categories, ...extraCategories])];

  function openManage() {
    const initial: Record<string, string> = {};
    allCategories.forEach((c) => {
      initial[c] = c;
    });
    setCategoryEdits(initial);
    setNewCatName("");
    setManageOpen(true);
  }

  function handleAddCategory() {
    const name = newCatName.trim();
    if (!name) return;
    if (allCategories.includes(name)) {
      toast.error("이미 존재하는 카테고리입니다.");
      return;
    }
    const updated = [...extraCategories, name];
    setExtraCategories(updated);
    saveLocalCategories(tableName, updated);
    setCategoryEdits((prev) => ({ ...prev, [name]: name }));
    setNewCatName("");
    toast.success(`"${name}" 카테고리가 추가되었습니다.`);
  }

  function handleRemoveExtra(cat: string) {
    const updated = extraCategories.filter((c) => c !== cat);
    setExtraCategories(updated);
    saveLocalCategories(tableName, updated);
    setCategoryEdits((prev) => {
      const next = { ...prev };
      delete next[cat];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();

    const changed = Object.entries(categoryEdits).filter(
      ([oldCat, newCat]) => newCat.trim() && newCat.trim() !== oldCat
    );

    // DB에 있는 카테고리 이름 일괄 수정
    for (const [oldCat, newCat] of changed) {
      if (categories.includes(oldCat)) {
        await (supabase.from(tableName) as any)
          .update({ category: newCat.trim() })
          .eq("category", oldCat);
      }
    }

    // localStorage 카테고리 이름 수정
    let updatedExtras = [...extraCategories];
    for (const [oldCat, newCat] of changed) {
      if (extraCategories.includes(oldCat)) {
        updatedExtras = updatedExtras.map((c) => (c === oldCat ? newCat.trim() : c));
      }
    }
    if (updatedExtras.join(",") !== extraCategories.join(",")) {
      setExtraCategories(updatedExtras);
      saveLocalCategories(tableName, updatedExtras);
    }

    if (changed.length > 0) {
      toast.success(`카테고리 ${changed.length}개가 수정되었습니다.`);
      onCategoriesChange();
      onFilterChange(null);
    }

    setCategoryEdits({});
    setManageOpen(false);
    setSaving(false);
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap mb-4 items-center min-h-[32px]">
        {allCategories.length > 0 ? (
          <>
            <button
              onClick={() => onFilterChange(null)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                activeFilter === null
                  ? "bg-foreground text-background"
                  : "bg-surface border border-border text-foreground-secondary hover:text-foreground"
              )}
            >
              전체
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() =>
                  onFilterChange(cat === activeFilter ? null : cat)
                }
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  activeFilter === cat
                    ? "bg-foreground text-background"
                    : "bg-surface border border-border text-foreground-secondary hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </>
        ) : (
          <span className="text-xs text-foreground-tertiary flex items-center gap-1">
            <Tag className="h-3 w-3" />
            카테고리 없음
          </span>
        )}

        <button
          onClick={openManage}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-surface border border-dashed border-border text-foreground-tertiary hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          카테고리 관리
        </button>
      </div>

      <Dialog
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="카테고리 관리"
        className="md:max-w-md"
      >
        <div className="space-y-4">
          {/* 새 카테고리 추가 */}
          <div>
            <label className="text-xs font-medium text-foreground-secondary mb-1.5 block uppercase tracking-wide">
              새 카테고리 추가
            </label>
            <div className="flex gap-2">
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
                placeholder="카테고리 이름 입력 후 추가"
                className="flex-1"
              />
              <Button
                variant="secondary"
                onClick={handleAddCategory}
                disabled={!newCatName.trim()}
              >
                추가
              </Button>
            </div>
          </div>

          {/* 기존 카테고리 이름 수정 */}
          {Object.keys(categoryEdits).length > 0 ? (
            <div>
              <label className="text-xs font-medium text-foreground-secondary mb-1.5 block uppercase tracking-wide">
                카테고리 이름 수정
              </label>
              <p className="text-xs text-foreground-tertiary mb-2">
                이름 수정 시 해당 카테고리의 모든 항목에 일괄 적용됩니다.
              </p>
              <div className="space-y-2">
                {Object.entries(categoryEdits).map(([original, current]) => (
                  <div key={original} className="flex items-center gap-2">
                    <span className="text-xs text-foreground-secondary w-24 shrink-0 truncate">
                      {original}
                    </span>
                    <span className="text-foreground-tertiary">→</span>
                    <Input
                      value={current}
                      onChange={(e) =>
                        setCategoryEdits((prev) => ({
                          ...prev,
                          [original]: e.target.value,
                        }))
                      }
                      className="flex-1"
                      placeholder={original}
                    />
                    {extraCategories.includes(original) &&
                      !categories.includes(original) && (
                        <button
                          onClick={() => handleRemoveExtra(original)}
                          className="text-foreground-tertiary hover:text-foreground transition-colors shrink-0"
                          title="삭제"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-foreground-tertiary text-center py-2">
              아직 등록된 카테고리가 없습니다.
            </p>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="secondary"
              onClick={() => setManageOpen(false)}
              disabled={saving}
            >
              취소
            </Button>
            <Button onClick={handleSave} loading={saving}>
              저장
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
