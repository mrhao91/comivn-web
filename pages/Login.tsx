import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthService } from '../services/auth';
import { Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import AppModal, { ModalType } from '../components/AppModal';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    message: React.ReactNode;
  }>({ isOpen: false, type: 'alert', title: '', message: '' });

  const showAlert = (msg: string, title = 'Lỗi Đăng Nhập') => setModal({ isOpen: true, type: 'alert', title, message: msg });
  const closeModal = () => setModal(prev => ({ ...prev, isOpen: false }));

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await AuthService.login(username, password);
      if (result.success) {
        navigate('/admin');
      } else {
        showAlert(result.error || 'Tên đăng nhập hoặc mật khẩu không đúng!');
      }
    } catch (err) {
      showAlert('Đã xảy ra lỗi kết nối, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <AppModal 
        isOpen={modal.isOpen}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onClose={closeModal}
      />
      <div className="w-full max-w-md bg-card border border-white/10 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-3xl rounded-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-secondary/20 blur-3xl rounded-full -ml-16 -mb-16"></div>

        <div className="relative z-10">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl mx-auto flex items-center justify-center text-white mb-4 shadow-lg shadow-primary/20">
                    <ShieldCheck size={32} />
                </div>
                <h1 className="text-2xl font-bold text-white">Quản Trị Viên</h1>
                <p className="text-slate-400 text-sm mt-2">Đăng nhập để quản lý nội dung ComiVN</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 ml-1">Tài khoản</label>
                    <div className="relative">
                        <User className="absolute left-3 top-3 text-slate-500" size={18} />
                        <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-dark border border-white/10 rounded-xl py-2.5 px-4 pl-10 text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                            placeholder="Nhập tài khoản"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 ml-1">Mật khẩu</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-dark border border-white/10 rounded-xl py-2.5 px-4 pl-10 text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                            placeholder="Nhập mật khẩu"
                        />
                    </div>
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 mt-6 group"
                >
                    {loading ? (
                        <span>Đang xử lý...</span>
                    ) : (
                        <>
                            Đăng nhập <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};

export default Login;