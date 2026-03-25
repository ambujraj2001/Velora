import React from 'react';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  user?: { name: string; email: string; role?: string };
  noPadding?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, user, noPadding }) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0D0D0D] font-sans text-white">
      <Sidebar user={user} />
      <main
        className={`relative flex-1 bg-[#0D0D0D] overflow-y-auto min-w-0 ${noPadding ? '' : 'p-6 lg:p-10'}`}
      >
        <div className={`mx-auto h-full flex flex-col w-full ${noPadding ? 'max-w-none' : 'max-w-6xl'}`}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
