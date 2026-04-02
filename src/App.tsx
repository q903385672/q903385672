import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { 
  Play, Pause, Volume2, Clock, Trash2, Plus, LogIn, UserPlus, 
  Settings, Music, LogOut, Calendar, Save, RefreshCw, Upload, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface Song {
  id: string | number;
  title: string;
  artist: string;
  cover: string;
  url: string;
  color?: string;
  isNas?: boolean;
}

interface ScheduleTask {
  id: string | number;
  time: string;
  songId: string | number;
  songTitle: string;
  days: number[]; // 0-6 (Sun-Sat)
}

interface UserSettings {
  customSongs: Song[];
  scheduledTasks: ScheduleTask[];
  appTitle: string;
  appLogo: string;
}

// --- Constants ---
const DEFAULT_SONGS: Song[] = [
  { id: 1, title: '小火车', artist: '圈圈宝贝', cover: 'https://picsum.photos/seed/train/400/400', color: 'from-blue-50 to-indigo-50', url: 'https://music.163.com/song/media/outer/url?id=31134622.mp3' },
  { id: 2, title: '青石巷', artist: '魏琮霏', cover: 'https://picsum.photos/seed/alley/400/400', color: 'from-emerald-50 to-teal-50', url: 'https://music.163.com/song/media/outer/url?id=1299980643.mp3' },
  { id: 3, title: '饼干歌', artist: '儿歌', cover: 'https://picsum.photos/seed/cookie/400/400', color: 'from-orange-50 to-amber-50', url: 'https://music.163.com/song/media/outer/url?id=2108490510.mp3' },
];

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function App() {
  // --- Auth State ---
  const [user, setUser] = useState<{ username: string; token: string } | null>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'app'>('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '' });

  // --- App State ---
  const [activeTab, setActiveTab] = useState<'playlist' | 'nas' | 'admin'>('playlist');
  const [songs, setSongs] = useState<Song[]>(DEFAULT_SONGS);
  const [nasSongs, setNasSongs] = useState<Song[]>([]);
  const [adminUsers, setAdminUsers] = useState<{ id: number; username: string; role: string }[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSongForm, setNewSongForm] = useState({ title: '', artist: '', url: '' });
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState('0:00');
  const [duration, setDuration] = useState('0:00');
  const [scheduledTasks, setScheduledTasks] = useState<ScheduleTask[]>([]);
  const [appTitle, setAppTitle] = useState('我的歌单');
  const [appLogo, setAppLogo] = useState('https://musk-online.fbcontent.cn/pub-musk-ai-studio/user/upload/20/UeAcVkprce3FuFieWy788T.png');

  // --- Refs ---
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // --- Effects ---
  useEffect(() => {
    const savedToken = localStorage.getItem('nas_music_token');
    const savedUser = localStorage.getItem('nas_music_user');
    const savedRole = localStorage.getItem('nas_music_role');
    if (savedToken && savedUser) {
      setUser({ username: savedUser, token: savedToken });
      setUserRole(savedRole || 'user');
      setAuthMode('app');
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchNasLibrary();
      if (userRole === 'admin') {
        fetchAdminUsers();
      }
    }
  }, [user, userRole]);

  useEffect(() => {
    const timer = setInterval(checkSchedule, 1000);
    return () => clearInterval(timer);
  }, [scheduledTasks, songs, nasSongs]);

  // --- API Calls ---
  const fetchUserSettings = async (token: string) => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user?.username, password: '' }) // This is a mock for re-fetching settings
      });
      // In a real app, we'd have a GET /api/settings endpoint
    } catch (e) {
      console.error('Failed to fetch settings', e);
    }
  };

  const fetchNasLibrary = async () => {
    try {
      const res = await fetch('/api/library');
      const data = await res.json();
      setNasSongs(data);
    } catch (e) {
      console.error('Failed to fetch NAS library', e);
    }
  };

  const fetchAdminUsers = async () => {
    if (!user || userRole !== 'admin') return;
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) setAdminUsers(data);
    } catch (e) {
      console.error('Failed to fetch users', e);
    }
  };

  const deleteAdminUser = async (id: number) => {
    if (!user || userRole !== 'admin') return;
    if (!confirm('确定要删除该用户吗？')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
      });
      if (res.ok) {
        setAdminUsers(adminUsers.filter(u => u.id !== id));
      }
    } catch (e) {
      console.error('Failed to delete user', e);
    }
  };

  const saveSettingsToServer = async (newSettings: Partial<UserSettings>) => {
    if (!user) return;
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ settings: { ...newSettings } })
      });
      if (res.ok) {
        alert('配置已成功保存到您的账户');
      } else {
        alert('保存失败');
      }
    } catch (e) {
      console.error('Failed to save settings', e);
      alert('保存失败，请检查网络');
    }
  };

  // --- Auth Handlers ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = authMode === 'login' ? '/api/login' : '/api/register';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('nas_music_token', data.token);
        localStorage.setItem('nas_music_user', data.username);
        localStorage.setItem('nas_music_role', data.role || 'user');
        setUser({ username: data.username, token: data.token });
        setUserRole(data.role || 'user');
        setAuthMode('app');
        if (data.settings) {
          if (data.settings.customSongs) setSongs(data.settings.customSongs);
          if (data.settings.scheduledTasks) setScheduledTasks(data.settings.scheduledTasks);
          if (data.settings.appTitle) setAppTitle(data.settings.appTitle);
          if (data.settings.appLogo) setAppLogo(data.settings.appLogo);
        }
      } else if (authMode === 'register') {
        setAuthMode('login');
        alert('注册成功，请登录');
      } else {
        alert(data.error || '认证失败');
      }
    } catch (e) {
      alert('连接服务器失败');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('nas_music_token');
    localStorage.removeItem('nas_music_user');
    localStorage.removeItem('nas_music_role');
    setUser(null);
    setUserRole('user');
    setAuthMode('login');
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && currentSong) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newUrl = event.target?.result as string;
        const updatedSongs = songs.map(s => s.id === currentSong.id ? { ...s, cover: newUrl } : s);
        setSongs(updatedSongs);
        setCurrentSong({ ...currentSong, cover: newUrl });
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAppLogo(event.target?.result as string);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  // --- Music Handlers ---
  const playSong = (song: Song) => {
    setCurrentSong(song);
    if (audioRef.current) {
      audioRef.current.src = song.url;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentSong) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const checkSchedule = () => {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentSec = now.getSeconds();

    if (currentSec === 0) {
      const task = scheduledTasks.find(t => t.time === currentTimeStr && t.days.includes(currentDay));
      if (task) {
        const song = [...songs, ...nasSongs].find(s => s.id === task.songId);
        if (song) playSong(song);
      }
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // --- Render Helpers ---
  if (authMode !== 'app') {
    return (
      <div className="min-h-screen bg-[#F4F3EC] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-gray-100"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-[#2D593E]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Music className="w-10 h-10 text-[#2D593E]" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800">我的歌单</h1>
            <p className="text-gray-600 mt-2">专属音乐空间，记录教学点滴</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">用户名</label>
              <input 
                type="text" 
                required
                placeholder="请输入用户名"
                className="w-full px-4 py-4 rounded-2xl border-2 border-gray-100 focus:border-[#2D593E] outline-none transition-all bg-gray-50"
                value={authForm.username}
                onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">密码</label>
              <input 
                type="password" 
                required
                placeholder="请输入密码"
                className="w-full px-4 py-4 rounded-2xl border-2 border-gray-100 focus:border-[#2D593E] outline-none transition-all bg-gray-50"
                value={authForm.password}
                onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
              />
            </div>
            <div className="pt-4">
              <button 
                type="submit"
                className="w-full bg-[#2D593E] text-white py-4 rounded-2xl font-bold shadow-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 text-xl border-2 border-white/30"
              >
                {authMode === 'login' ? <LogIn className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
                {authMode === 'login' ? '立即登录' : '立即注册'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-[#2D593E] font-bold hover:underline text-lg"
            >
              {authMode === 'login' ? '没有账号？立即注册' : '已有账号？返回登录'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F3EC] p-4 md:p-8">
      <audio 
        ref={audioRef} 
        onTimeUpdate={() => {
          if (audioRef.current) {
            const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
            setProgress(p);
            setCurrentTime(formatTime(audioRef.current.currentTime));
            setDuration(formatTime(audioRef.current.duration));
          }
        }}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between mb-10 gap-4">
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => logoInputRef.current?.click()}>
              <img src={appLogo} className="w-16 h-16 rounded-2xl shadow-lg object-cover" alt="Logo" />
              <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Settings className="w-6 h-6 text-white" />
              </div>
            </div>
            <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoChange} />
            <div>
              <h1 className="text-3xl font-bold text-gray-800 cursor-pointer hover:text-primary transition-colors" onClick={() => {
                const t = prompt('修改标题:', appTitle);
                if (t) setAppTitle(t);
              }}>{appTitle}</h1>
              <p className="text-gray-600 flex items-center gap-2 font-medium">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                专属音乐空间，记录教学点滴
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => saveSettingsToServer({ customSongs: songs, scheduledTasks, appTitle, appLogo })}
              className="bg-white text-primary border border-primary/20 px-5 py-2.5 rounded-xl font-bold shadow-sm hover:bg-primary/5 transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> 保存配置
            </button>
            <button 
              onClick={handleLogout}
              className="bg-red-50 text-red-500 px-5 py-2.5 rounded-xl font-bold shadow-sm hover:bg-red-100 transition-all flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" /> 退出
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Music Library */}
          <div className="lg:col-span-8 space-y-6">
            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-white/50 backdrop-blur-md rounded-2xl w-fit border border-white/50">
              <button 
                onClick={() => setActiveTab('playlist')}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'playlist' ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:bg-white/50'}`}
              >
                <Music className="w-4 h-4" /> 我的歌单
              </button>
              <button 
                onClick={() => setActiveTab('nas')}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'nas' ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:bg-white/50'}`}
              >
                <RefreshCw className="w-4 h-4" /> NAS 音乐库
              </button>
              {userRole === 'admin' && (
                <button 
                  onClick={() => setActiveTab('admin')}
                  className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'admin' ? 'bg-red-500 text-white shadow-lg' : 'text-red-500 hover:bg-red-50'}`}
                >
                  <Users className="w-4 h-4" /> 用户管理
                </button>
              )}
            </div>

            {activeTab === 'admin' && userRole === 'admin' ? (
              /* Admin Dashboard */
              <section className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/50 min-h-[500px]">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Users className="w-6 h-6 text-red-500" /> 用户管理后台
                  </h2>
                  <button onClick={fetchAdminUsers} className="text-gray-500 hover:rotate-180 transition-all duration-500 p-2 bg-gray-100 rounded-xl">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  {adminUsers.length === 0 ? (
                    <p className="text-center py-20 text-gray-400">暂无其他用户</p>
                  ) : (
                    adminUsers.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">
                            {u.username[0].toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-800">{u.username}</h3>
                            <p className="text-xs text-gray-400">角色: {u.role === 'admin' ? '管理员' : '普通用户'}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteAdminUser(u.id)}
                          className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          title="删除用户"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            ) : activeTab === 'nas' ? (
              /* NAS Library */
              <section className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/50 min-h-[500px]">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <RefreshCw className="w-6 h-6 text-primary" /> NAS 音乐库
                  </h2>
                  <button onClick={fetchNasLibrary} className="text-primary hover:rotate-180 transition-all duration-500 p-2 bg-primary/5 rounded-xl">
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>
                
                {nasSongs.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-2xl">
                    <Upload className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">NAS 音乐文件夹为空</p>
                    <p className="text-xs text-gray-400 mt-2">请将音乐文件放入服务器的 music 目录</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {nasSongs.map(song => (
                      <motion.div 
                        key={song.id}
                        whileHover={{ y: -5 }}
                        onClick={() => playSong(song)}
                        className={`cursor-pointer bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-4 border border-transparent hover:border-primary/20 transition-all group ${currentSong?.id === song.id ? 'ring-2 ring-primary shadow-lg' : ''}`}
                      >
                        <div className="aspect-square rounded-xl overflow-hidden mb-3 bg-white relative">
                          <img src={song.cover} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={song.title} />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Play className="w-14 h-14 text-white fill-white drop-shadow-2xl" />
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              const newSong = { ...song, id: Date.now() + Math.random() };
                              setSongs([...songs, newSong]);
                              alert(`已将 "${song.title}" 添加到我的歌单`);
                            }}
                            className="absolute top-2 right-2 p-2 bg-white/90 rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary hover:text-white"
                            title="添加到我的歌单"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        <h3 className="font-bold text-gray-800 text-sm truncate">{song.title}</h3>
                        <p className="text-xs text-gray-400 truncate">{song.artist}</p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              /* Custom Playlist */
              <section className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/50 min-h-[500px]">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Music className="w-6 h-6 text-primary" /> 我的歌单
                  </h2>
                  <button 
                    onClick={() => setShowAddModal(true)}
                    className="bg-primary text-white p-3 rounded-2xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {songs.map(song => (
                    <motion.div 
                      key={song.id}
                      whileHover={{ y: -5 }}
                      onClick={() => playSong(song)}
                      className={`cursor-pointer bg-gradient-to-br ${song.color || 'from-gray-50 to-slate-50'} rounded-2xl p-4 border border-transparent hover:border-primary/20 transition-all group ${currentSong?.id === song.id ? 'ring-2 ring-primary shadow-lg' : ''}`}
                    >
                      <div className="aspect-square rounded-xl overflow-hidden mb-3 bg-white relative">
                        <img src={song.cover} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={song.title} />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Play className="w-14 h-14 text-white fill-white drop-shadow-2xl" />
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSongs(songs.filter(s => s.id !== song.id));
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-xl opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all shadow-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <h3 className="font-bold text-gray-800 text-sm truncate">{song.title}</h3>
                      <p className="text-xs text-gray-400 truncate">{song.artist}</p>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right Column: Player & Schedule */}
          <div className="lg:col-span-4 space-y-6">
            {/* Player Card */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl border border-gray-100 sticky top-8">
              <div className="text-center mb-8">
                <motion.div 
                  animate={{ rotate: isPlaying ? 360 : 0 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="w-48 h-48 mx-auto mb-6 rounded-full overflow-hidden shadow-2xl border-8 border-gray-50 bg-gray-100 relative group cursor-pointer"
                  onClick={() => coverInputRef.current?.click()}
                >
                  <img src={currentSong?.cover || 'https://picsum.photos/seed/placeholder/400/400'} className="w-full h-full object-cover" alt="Cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Settings className="w-8 h-8 text-white" />
                  </div>
                </motion.div>
                <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={handleCoverChange} />
                <h3 className="text-2xl font-bold text-gray-800 mb-1 truncate">{currentSong?.title || '请选择歌曲'}</h3>
                <p className="text-primary font-medium">{currentSong?.artist || '等待播放...'}</p>
              </div>

              {/* Progress Bar */}
              <div className="mb-8">
                <div className="flex justify-between text-xs text-gray-400 mb-2 font-mono">
                  <span>{currentTime}</span>
                  <span>{duration}</span>
                </div>
                <div 
                  className="h-2 bg-gray-100 rounded-full overflow-hidden cursor-pointer"
                  onClick={(e) => {
                    if (audioRef.current) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const p = x / rect.width;
                      audioRef.current.currentTime = p * audioRef.current.duration;
                    }
                  }}
                >
                  <div className="h-full bg-primary w-full origin-left transition-transform duration-100" style={{ transform: `scaleX(${progress / 100})` }}></div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex justify-center items-center gap-8 mb-10">
                <button 
                  onClick={togglePlay}
                  className="w-24 h-24 bg-primary text-white rounded-full shadow-2xl shadow-primary/50 flex items-center justify-center hover:scale-105 active:scale-95 transition-all border-8 border-white"
                >
                  {isPlaying ? <Pause className="w-12 h-12 fill-white" /> : <Play className="w-12 h-12 fill-white ml-1" />}
                </button>
              </div>

              {/* Volume */}
              <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-4">
                <Volume2 className="w-5 h-5 text-gray-400" />
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={volume}
                  onChange={e => {
                    const v = parseInt(e.target.value);
                    setVolume(v);
                    if (audioRef.current) audioRef.current.volume = v / 100;
                  }}
                  className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-primary"
                />
              </div>

              {/* Schedule Panel */}
              <div className="mt-8 pt-8 border-t border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" /> 预约播放列表
                  </h4>
                </div>

                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-2xl space-y-3">
                    <div className="flex gap-2">
                      <input 
                        type="time" 
                        id="taskTime"
                        className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                      <button 
                        onClick={() => {
                          const time = (document.getElementById('taskTime') as HTMLInputElement).value;
                          if (!time || !currentSong) return alert('请选择时间和歌曲');
                          const newTask: ScheduleTask = {
                            id: Date.now(),
                            time,
                            songId: currentSong.id,
                            songTitle: currentSong.title,
                            days: [1, 2, 3, 4, 5] // Default Mon-Fri
                          };
                          setScheduledTasks([...scheduledTasks, newTask]);
                        }}
                        className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md"
                      >
                        添加
                      </button>
                    </div>
                    
                    {/* Task List */}
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {scheduledTasks.length === 0 ? (
                        <p className="text-center text-gray-400 text-xs py-4">暂无预约任务</p>
                      ) : (
                        scheduledTasks.map(task => (
                          <div key={task.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-primary bg-primary/5 px-2 py-1 rounded-lg">{task.time}</span>
                                <div className="flex gap-1">
                                  {task.days.sort().map(d => (
                                    <span key={d} className="text-[10px] bg-gray-100 text-gray-500 w-5 h-5 flex items-center justify-center rounded-md font-bold">
                                      {WEEKDAYS[d]}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <button onClick={() => setScheduledTasks(scheduledTasks.filter(t => t.id !== task.id))}>
                                <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-500" />
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 mb-2 truncate">{task.songTitle}</p>
                            <div className="flex justify-between">
                              {WEEKDAYS.map((day, idx) => (
                                <button 
                                  key={idx}
                                  onClick={() => {
                                    const newTasks = scheduledTasks.map(t => {
                                      if (t.id === task.id) {
                                        const days = t.days.includes(idx) 
                                          ? t.days.filter(d => d !== idx)
                                          : [...t.days, idx];
                                        return { ...t, days };
                                      }
                                      return t;
                                    });
                                    setScheduledTasks(newTasks);
                                  }}
                                  className={`w-6 h-6 rounded-md text-[10px] flex items-center justify-center transition-all ${task.days.includes(idx) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Song Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-6 text-gray-800">添加在线歌曲</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">歌曲名称</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-primary outline-none"
                    placeholder="例如: 小火车"
                    value={newSongForm.title}
                    onChange={e => setNewSongForm({ ...newSongForm, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">艺术家</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-primary outline-none"
                    placeholder="例如: 圈圈宝贝"
                    value={newSongForm.artist}
                    onChange={e => setNewSongForm({ ...newSongForm, artist: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">音乐链接 (URL)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 focus:border-primary outline-none"
                    placeholder="https://..."
                    value={newSongForm.url}
                    onChange={e => setNewSongForm({ ...newSongForm, url: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    if (newSongForm.title && newSongForm.url) {
                      setSongs([...songs, { 
                        id: Date.now(), 
                        ...newSongForm, 
                        cover: 'https://picsum.photos/seed/' + Date.now() + '/400/400',
                        color: 'from-gray-50 to-slate-50'
                      }]);
                      setShowAddModal(false);
                      setNewSongForm({ title: '', artist: '', url: '' });
                    } else {
                      alert('请填写名称和链接');
                    }
                  }}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-primary shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
                >
                  确认添加
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
