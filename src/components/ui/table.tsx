import { cn } from "@/lib/utils";

export function Table({ className, children, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn("hidden md:table-header-group bg-surface text-foreground-secondary text-xs uppercase tracking-wide", className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("", className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({ className, children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-border hover:bg-surface-hover transition-colors",
        // Mobile: 카드형
        "flex flex-col gap-1 p-4 md:table-row md:p-0",
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ className, children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("py-3 px-4 text-left font-medium", className)} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ className, label, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { label?: string }) {
  return (
    <td className={cn("py-3 px-4 md:py-3", className)} {...props}>
      {/* Mobile: label 표시 */}
      {label && (
        <span className="text-xs text-foreground-tertiary md:hidden mr-2">{label}:</span>
      )}
      {children}
    </td>
  );
}
