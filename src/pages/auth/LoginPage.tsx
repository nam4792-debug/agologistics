import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui';
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
            const result = await login(email, password);
            if (result.success) {
                navigate('/');
            } else {
                setError(result.error || 'Invalid email or password');
            }
        } catch (err) {
            setError('Cannot connect to server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-800 via-emerald-900 to-emerald-950 flex items-center justify-center p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-green-400/15 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 bg-white/10 backdrop-blur-sm border border-white/10 shadow-lg">
                        <img src="/logo-agofruit.png" alt="Ago Fruit" className="w-16 h-16 object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Ago Import Export</h1>
                    <p className="text-emerald-200/70 mt-1 text-sm">Co.,Ltd — Fruit Export Management</p>
                </div>

                {/* Login Form */}
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/15 p-8 shadow-2xl">
                    <h2 className="text-xl font-semibold text-white mb-6 text-center">
                        Sign In
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/15 border border-red-400/30 text-red-200">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span className="text-sm">{error}</span>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-emerald-100 mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                placeholder="admin@logispro.vn"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full h-10 px-3 py-2 rounded-lg border border-white/20 bg-white/10 text-white placeholder:text-emerald-200/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400/50 transition-all text-sm backdrop-blur-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-emerald-100 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full h-10 px-3 py-2 rounded-lg border border-white/20 bg-white/10 text-white placeholder:text-emerald-200/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400/50 transition-all text-sm backdrop-blur-sm"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 mt-6 from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 shadow-lg"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </Button>
                    </form>

                    {/* Demo accounts */}
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <p className="text-xs text-emerald-200/50 text-center mb-3">
                            Demo account:
                        </p>
                        <div className="space-y-1 text-xs text-center text-emerald-200/60">
                            <p><code className="bg-white/10 px-1.5 py-0.5 rounded text-emerald-100">admin@logispro.vn</code> / <code className="bg-white/10 px-1.5 py-0.5 rounded text-emerald-100">admin123</code></p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-xs text-emerald-300/40 mt-6">
                    © 2026 Ago Import Export Co.,Ltd. All rights reserved.
                </p>
            </div>
        </div>
    );
}
