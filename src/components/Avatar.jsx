export default function Avatar({ name, src, size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };
  const initials = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const sizeClass = sizes[size] || sizes.md;

  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-[#c4a77d] to-[#8b7355] flex items-center justify-center text-[#1a1612] font-bold shrink-0 overflow-hidden ${className}`}>
      {src ? (
        <img src={src} alt={name || 'Perfil'} className="w-full h-full object-cover" />
      ) : initials}
    </div>
  );
}
