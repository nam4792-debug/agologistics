import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ship, Loader2, AlertCircle } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';

export function LoginPage() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const success = await login(email, password);
            if (success) {
                navigate('/');
            } else {
                setError('Email hoặc mật khẩu không đúng');
            }
        } catch {
            setError('Không thể kết nối server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
                        <Ship className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-[hsl(var(--foreground))]">LogisPro</h1>
                    <p className="text-[hsl(var(--muted-foreground))] mt-2">Export Logistics Management</p>
                </div>

                {/* Login Form */}
                <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-8 shadow-2xl">
                    <h2 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-6 text-center">
                        Đăng nhập
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span className="text-sm">{error}</span>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                Email
                            </label>
                            <Input
                                type="email"
                                placeholder="admin@logispro.vn"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                                Mật khẩu
                            </label>
                            <Input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 mt-6"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Đang đăng nhập...
                                </>
                            ) : (
                                'Đăng nhập'
                            )}
                        </Button>
                    </form>

                    {/* Demo accounts */}
                    <div className="mt-6 pt-6 border-t border-[hsl(var(--border))]">
                        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center mb-3">
                            Tài khoản demo:
                        </p>
                        <div className="space-y-1 text-xs text-center text-[hsl(var(--muted-foreground))]">
                            <p><code className="bg-[hsl(var(--secondary))] px-1 rounded">admin@logispro.vn</code> / <code className="bg-[hsl(var(--secondary))] px-1 rounded">admin123</code></p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-[hsl(var(--muted-foreground))] mt-6">
                    © 2026 LogisPro. All rights reserved.
                </p>
            </div>
        </div>
    );
}
