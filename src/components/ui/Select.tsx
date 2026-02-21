import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: { value: string; label: string }[];
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, label, error, options, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="mb-2 block text-sm font-medium text-[hsl(var(--foreground))]">
                        {label}
                    </label>
                )}
                <select
                    className={cn(
                        'flex h-10 w-full rounded-lg border border-[hsl(var(--input))]/60 bg-[hsl(var(--card))] px-3 py-2 pr-8 text-sm text-[hsl(var(--foreground))] ring-offset-[hsl(var(--background))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]/20 focus-visible:border-[hsl(var(--ring))]/50 focus-visible:shadow-[0_0_0_3px_hsl(var(--ring)/0.08)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 appearance-none cursor-pointer',
                        'bg-[length:16px_16px] bg-[position:right_8px_center] bg-no-repeat',
                        'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%239ca3af\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")]',
                        error && 'border-[hsl(var(--destructive))] focus-visible:ring-[hsl(var(--destructive))]/20 focus-visible:border-[hsl(var(--destructive))]/50',
                        className
                    )}
                    ref={ref}
                    {...props}
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                {error && (
                    <p className="mt-1.5 text-sm text-[hsl(var(--destructive))]">{error}</p>
                )}
            </div>
        );
    }
);
Select.displayName = 'Select';

export { Select };
