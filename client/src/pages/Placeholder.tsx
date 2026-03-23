import React from 'react';
import { useLocation } from 'react-router-dom';
import { Construction } from 'lucide-react';
import Layout from '../components/Layout';

const Placeholder: React.FC = () => {
  const location = useLocation();
  const pageName = location.pathname.substring(1).replace('-', ' ');

  return (
    <Layout>
      <div className="flex h-full flex-1 flex-col items-center justify-center text-center opacity-60">
        <div className="mb-6 rounded-full bg-[#1A1A1A] p-6 text-[#F06543]">
          <Construction size={48} />
        </div>
        <h2 className="mb-2 text-2xl font-bold capitalize text-white">
          {pageName || 'Page'} under construction
        </h2>
        <p className="max-w-md text-[#666]">
          We're still working on the {pageName} details. Stay tuned for updates!
        </p>
      </div>
    </Layout>
  );
};

export default Placeholder;
