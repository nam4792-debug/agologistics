import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]/30 focus-visible:ring-offset-1 focus-visible:ring-offset-[hsl(var(--background))] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
    {
        variants: {
            variant: {
                default: 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-[var(--shadow-sm)] hover:from-emerald-500 hover:to-green-500 hover:shadow-[var(--shadow-md)]',
                destructive: 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] shadow-[var(--shadow-sm)] hover:bg-[hsl(var(--destructive))]/90 hover:shadow-[var(--shadow-md)]',
                outline: 'border border-[hsl(var(--border))] bg-transparent hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] hover:shadow-[var(--shadow-xs)] hover:border-[hsl(var(--border))]/80',
                secondary: 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary))]/80 hover:shadow-[var(--shadow-xs)]',
                ghost: 'hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]',
                link: 'text-[hsl(var(--primary))] underline-offset-4 hover:underline',
                success: 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-[var(--shadow-sm)] hover:from-green-500 hover:to-emerald-500 hover:shadow-[var(--shadow-md)]',
                warning: 'bg-[hsl(var(--warning))] text-black shadow-[var(--shadow-sm)] hover:bg-[hsl(var(--warning))]/90 hover:shadow-[var(--shadow-md)]',
            },
            size: {
                default: 'h-10 px-4 py-2',
                sm: 'h-8 rounded-md px-3 text-xs',
                lg: 'h-12 rounded-lg px-8 text-base',
                xl: 'h-14 rounded-xl px-10 text-lg',
                icon: 'h-10 w-10',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
        return (
            <button
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading ? (
                    <svg
                        className="h-4 w-4 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                ) : null}
                {children}
            </button>
        );
    }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
