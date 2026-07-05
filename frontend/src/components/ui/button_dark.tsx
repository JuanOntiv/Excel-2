interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const Button = ({ children, onClick, className = '' }: ButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 bg-primary text-white rounded-lg hover:opacity-80 transition ${className}`}
    >
      {children}
    </button>
  );
};
