import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, label, error, icon, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="mb-2 block text-sm font-medium text-[hsl(var(--foreground))]">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {icon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]">
                            {icon}
                        </div>
                    )}
                    <input
                        type={type}
                        className={cn(
                            'flex h-10 w-full rounded-lg border border-[hsl(var(--input))]/60 bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--foreground))] ring-offset-[hsl(var(--background))] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[hsl(var(--muted-foreground))]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]/20 focus-visible:border-[hsl(var(--ring))]/50 focus-visible:shadow-[0_0_0_3px_hsl(var(--ring)/0.08)] disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200',
                            icon && 'pl-10',
                            error && 'border-[hsl(var(--destructive))] focus-visible:ring-[hsl(var(--destructive))]/20 focus-visible:border-[hsl(var(--destructive))]/50',
                            className
                        )}
                        ref={ref}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="mt-1.5 text-sm text-[hsl(var(--destructive))]">{error}</p>
                )}
            </div>
        );
    }
);
Input.displayName = 'Input';

export { Input };
