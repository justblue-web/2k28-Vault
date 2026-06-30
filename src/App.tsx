import { useState, useEffect, MouseEvent } from "react";
import { 
  Heart, 
  Download, 
  ExternalLink, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  Maximize2,
  RefreshCw,
  Image as ImageIcon,
  Check,
  ArrowUpDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Photo {
  id: string;
  name: string;
  rawName: string;
  likes: number;
}

export default function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Local storage likes state: { [photoId]: likes }
  const [localLikes, setLocalLikes] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("photo_vault_likes");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<"likes" | "name">("likes");

  // Fetch photos from our backend Express API
  const fetchPhotos = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    try {
      const res = await fetch("/api/photos");
      if (!res.ok) throw new Error("Failed to fetch folder contents");
      const data = await res.json();
      
      if (data.success && data.files) {
        // Map the files to photos
        const mappedPhotos = data.files.map((file: { id: string; name: string }) => {
          const currentLikes = localLikes[file.id] !== undefined ? localLikes[file.id] : 0;
          return {
            id: file.id,
            name: cleanFileName(file.name),
            rawName: file.name,
            likes: currentLikes
          };
        });
        setPhotos(mappedPhotos);
        setError(null);
      } else {
        throw new Error(data.error || "Failed to parse files");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Could not connect to folder feed");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, []);

  // Sync localLikes to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("photo_vault_likes", JSON.stringify(localLikes));
  }, [localLikes]);

  // Clean file extensions or common suffixes for display names
  const cleanFileName = (name: string): string => {
    if (!name) return "Untitled Photo";
    // Remove extensions like .jpg, .jpeg, .png, .gif, .webp, .tiff case-insensitive
    let cleaned = name.replace(/\.(jpg|jpeg|png|gif|webp|tiff)$/i, "");
    // Replace underscores, hyphens with spaces for clean typography
    cleaned = cleaned.replace(/[_-]/g, " ");
    return cleaned;
  };

  // Handle clicking the like button
  const handleLike = (e: MouseEvent, photoId: string) => {
    e.stopPropagation();
    const currentLikes = localLikes[photoId] !== undefined ? localLikes[photoId] : 0;
    const newLikes = currentLikes + 1;
    
    setLocalLikes(prev => ({
      ...prev,
      [photoId]: newLikes
    }));

    setPhotos(prev => 
      prev.map(p => p.id === photoId ? { ...p, likes: newLikes } : p)
    );
  };

  // Copy direct link to clipboard
  const handleCopyLink = (e: MouseEvent, id: string) => {
    e.stopPropagation();
    const url = `https://lh3.googleusercontent.com/d/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  // Trigger server-side proxy download
  const handleDownload = (e: MouseEvent, photo: Photo) => {
    e.stopPropagation();
    const downloadUrl = `/api/download?id=${photo.id}&name=${encodeURIComponent(photo.rawName || photo.name)}`;
    window.open(downloadUrl, "_blank");
  };

  // Filter and sort photos
  const filteredPhotos = photos
    .filter(photo => photo.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "likes") {
        return b.likes - a.likes; // Vary position by amount of likes
      } else {
        return a.name.localeCompare(b.name);
      }
    });

  // Lightbox keyboard and navigation controls
  const handleNext = () => {
    if (selectedPhotoIndex === null) return;
    setSelectedPhotoIndex((selectedPhotoIndex + 1) % filteredPhotos.length);
  };

  const handlePrev = () => {
    if (selectedPhotoIndex === null) return;
    setSelectedPhotoIndex((selectedPhotoIndex - 1 + filteredPhotos.length) % filteredPhotos.length);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedPhotoIndex === null) return;
      if (e.key === "Escape") setSelectedPhotoIndex(null);
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPhotoIndex, filteredPhotos]);

  return (
    <div id="photo-app-root" className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col font-sans selection:bg-white selection:text-black antialiased">
      
      {/* HEADER SECTION */}
      <header className="border-b border-zinc-900 bg-[#050505]/80 backdrop-blur-md sticky top-0 z-40 px-6 py-5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          
          {/* Logo & Subtitle */}
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-light uppercase tracking-[0.25em] text-white">
                2K28 <span className="font-semibold text-zinc-400">VAULT</span>
              </h1>
              <span className="bg-zinc-900 text-zinc-500 text-[8px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border border-zinc-800">
                CLOUD SYNC
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">
              Live Google Drive Public Folder Set
            </p>
          </div>

          {/* Search and Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            {/* Real-time Search */}
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                id="search-input"
                type="text"
                placeholder="Search gallery..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0d0d0d] border border-zinc-800 rounded py-2 pl-9 pr-4 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-all uppercase tracking-wider"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort Order Selector */}
            <button
              onClick={() => setSortBy(sortBy === "likes" ? "name" : "likes")}
              className="flex items-center justify-center gap-2 bg-[#0d0d0d] hover:bg-[#151515] text-zinc-300 hover:text-white border border-zinc-800 text-xs uppercase tracking-wider px-4 py-2 rounded transition-all w-full sm:w-auto"
              title="Toggle Sort Order"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort: {sortBy === "likes" ? "Most Liked" : "Name"}</span>
            </button>

            {/* Refresh Sync Button */}
            <button
              onClick={() => fetchPhotos(true)}
              disabled={isRefreshing}
              className="flex items-center justify-center p-2 rounded bg-[#0d0d0d] hover:bg-[#151515] text-zinc-400 hover:text-white border border-zinc-800 transition-all disabled:opacity-50"
              title="Refresh Sync"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>

        </div>
      </header>

      {/* MAIN LAYOUT CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 md:py-16">
        
        {/* Sync Status / Info Box */}
        <div className="mb-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-zinc-900 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
              Folder Connection Active &bull; <span className="text-zinc-500">Auto sorting by popularity</span>
            </p>
          </div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Total Photos: <span className="text-white font-medium">{filteredPhotos.length}</span>
          </div>
        </div>

        {/* LOADING STATE */}
        {loading ? (
          <div className="flex flex-col items-center justify-center text-center py-32">
            <div className="w-8 h-8 border-2 border-zinc-850 border-t-white rounded-full animate-spin mb-6" />
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Retrieving drive assets...</p>
          </div>
        ) : error ? (
          /* ERROR STATE */
          <div className="flex flex-col items-center justify-center text-center py-24 border border-dashed border-zinc-900 rounded p-6">
            <p className="text-sm font-light uppercase tracking-wider text-red-400 mb-2">Folder feed offline</p>
            <p className="text-xs text-zinc-500 mb-6">{error}</p>
            <button
              onClick={() => {
                setLoading(true);
                fetchPhotos();
              }}
              className="px-4 py-2 bg-white text-black font-semibold text-xs uppercase tracking-wider rounded hover:bg-zinc-200 transition-all"
            >
              Retry Connection
            </button>
          </div>
        ) : filteredPhotos.length === 0 ? (
          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center text-center py-32 border border-zinc-900 rounded bg-[#0b0b0b]/30">
            <ImageIcon className="w-10 h-10 text-zinc-800 mb-4 stroke-1" />
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">No photos match your filter</p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="mt-6 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold uppercase tracking-wider rounded text-white transition-all"
              >
                Clear Search Filter
              </button>
            )}
          </div>
        ) : (
          /* PHOTO GRID WITH FRAMER MOTION LAYOUT TRANSITIONS */
          <motion.div 
            id="photo-grid" 
            layout
            className="columns-1 sm:columns-2 lg:columns-3 gap-8 space-y-8"
          >
            <AnimatePresence mode="popLayout">
              {filteredPhotos.map((photo, index) => {
                const directUrl = `https://lh3.googleusercontent.com/d/${photo.id}`;
                return (
                  <motion.div
                    key={photo.id}
                    layoutId={`card-${photo.id}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="break-inside-avoid inline-block w-full group relative flex flex-col bg-[#0b0b0b] border border-zinc-900 overflow-hidden cursor-pointer hover:border-zinc-750 transition-all duration-300 mb-8"
                    onClick={() => setSelectedPhotoIndex(index)}
                  >
                    {/* PHOTO aspect container */}
                    <div className="relative bg-[#080808] overflow-hidden flex items-center justify-center">
                      <img
                        src={directUrl}
                        alt={photo.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-auto object-contain transition-all duration-700 ease-out group-hover:scale-105"
                      />
                      
                      {/* Dark Overlay on Hover */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-6">
                        {/* Top corner Inspect icon */}
                        <div className="flex justify-end">
                          <span className="p-2 bg-zinc-900/80 backdrop-blur-sm rounded text-zinc-400 hover:text-white transition-all">
                            <Maximize2 className="w-3.5 h-3.5" />
                          </span>
                        </div>

                        {/* Hover Quick Actions */}
                        <div className="flex items-center justify-between gap-4">
                          <button
                            onClick={(e) => handleLike(e, photo.id)}
                            className="flex items-center gap-1.5 bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 text-zinc-300 hover:text-red-400 px-3 py-1.5 rounded transition-all hover:border-red-500/30"
                            title="Like Photo"
                          >
                            <Heart className="w-3.5 h-3.5 fill-current" />
                            <span className="text-[11px] font-medium font-mono">{photo.likes}</span>
                          </button>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleCopyLink(e, photo.id)}
                              className="p-1.5 bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 text-zinc-400 hover:text-white rounded transition-colors"
                              title="Copy Direct URL"
                            >
                              {copiedId === photo.id ? (
                                <Check className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <ExternalLink className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={(e) => handleDownload(e, photo)}
                              className="p-1.5 bg-zinc-900/90 backdrop-blur-sm border border-zinc-800 text-zinc-400 hover:text-white rounded transition-colors"
                              title="Download Photo"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* PHOTO BOTTOM CARD INFO */}
                    <div className="p-4 flex items-center justify-between border-t border-zinc-900 bg-[#0d0d0d]">
                      <div className="truncate pr-4">
                        <h4 className="text-[11px] uppercase tracking-wider text-zinc-300 font-medium group-hover:text-white transition-colors truncate">
                          {photo.name}
                        </h4>
                      </div>
                      
                      {/* Non-hover Likes status badge */}
                      <button 
                        onClick={(e) => handleLike(e, photo.id)}
                        className="flex items-center gap-1 text-zinc-600 hover:text-red-400 transition-colors shrink-0"
                      >
                        <Heart className="w-3 h-3 fill-current" />
                        <span className="text-[10px] font-mono">{photo.likes}</span>
                      </button>
                    </div>

                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-zinc-900 py-10 bg-[#050505] z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-[9px] text-zinc-600 tracking-[0.2em] uppercase">
            &copy; 2026 2K28 Vault. Powering instant Google Drive CDN direct delivery.
          </p>
          <div className="flex gap-6 text-[9px] text-zinc-600 tracking-[0.2em] uppercase">
            <span className="hover:text-zinc-400 cursor-pointer transition-colors">Privacy</span>
            <span className="hover:text-zinc-400 cursor-pointer transition-colors">Terms</span>
          </div>
        </div>
      </footer>

      {/* FULLSCREEN LIGHTBOX DIALOG */}
      <AnimatePresence>
        {selectedPhotoIndex !== null && (
          <motion.div
            id="lightbox-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPhotoIndex(null)}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050505]/98 backdrop-blur-lg px-6 py-8"
          >
            {/* CLOSE LIGHTBOX BUTTON */}
            <button
              id="close-lightbox-btn"
              onClick={() => setSelectedPhotoIndex(null)}
              className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white transition-colors focus:outline-none"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>

            {/* PREVIOUS PHOTO BUTTON */}
            <button
              id="prev-card-btn"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-zinc-900/50 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded border border-zinc-800 transition-all focus:outline-none backdrop-blur-sm"
              title="Previous Photo (Left Arrow)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* LIGHTBOX MAIN PHOTO CONTAINER */}
            <div 
              className="relative max-w-4xl max-h-[75vh] w-full overflow-hidden border border-zinc-900 bg-black flex items-center justify-center rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={`https://lh3.googleusercontent.com/d/${filteredPhotos[selectedPhotoIndex].id}`}
                alt={filteredPhotos[selectedPhotoIndex].name}
                className="max-h-[75vh] max-w-full object-contain"
              />
            </div>

            {/* DESCRIPTION & CONTROLS LIGHTBOX FOOTER */}
            <div 
              className="mt-8 text-center max-w-xl px-4 flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xs uppercase tracking-[0.3em] text-white font-medium mb-3">
                {filteredPhotos[selectedPhotoIndex].name}
              </h3>
              
              <div className="flex items-center gap-4 mt-2">
                <button
                  onClick={(e) => handleLike(e, filteredPhotos[selectedPhotoIndex!].id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded text-xs tracking-wider uppercase font-medium text-red-400"
                >
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  <span className="font-mono">{filteredPhotos[selectedPhotoIndex].likes}</span>
                </button>

                <button
                  onClick={(e) => handleDownload(e, filteredPhotos[selectedPhotoIndex!])}
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded text-[10px] uppercase font-bold tracking-wider text-zinc-300 hover:text-white transition-all"
                >
                  <Download className="w-3 h-3" />
                  <span>Download Photo</span>
                </button>

                <button
                  onClick={(e) => handleCopyLink(e, filteredPhotos[selectedPhotoIndex!].id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded text-[10px] uppercase font-bold tracking-wider text-zinc-300 hover:text-white transition-all"
                >
                  {copiedId === filteredPhotos[selectedPhotoIndex].id ? (
                    <>
                      <Check className="w-3 h-3 text-green-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-3 h-3" />
                      <span>Direct URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* NEXT PHOTO BUTTON */}
            <button
              id="next-card-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-zinc-900/50 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded border border-zinc-800 transition-all focus:outline-none backdrop-blur-sm"
              title="Next Photo (Right Arrow)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
