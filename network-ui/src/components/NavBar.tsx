import React from 'react';

export type ViewName = 'landing' | 'explorer' | 'dashboard' | 'centrality' | 'communities' | 'path' | 'person';

interface NavBarProps {
  activeView: ViewName;
  onChange: (view: ViewName) => void;
}

const TABS: { id: ViewName; label: string }[] = [
  { id: 'landing',     label: 'Home' },
  { id: 'explorer',    label: 'Graph Explorer' },
  { id: 'dashboard',   label: 'SNA Dashboard' },
  { id: 'centrality',  label: 'Centrality' },
  { id: 'communities', label: 'Communities' },
  { id: 'path',        label: 'Path Finder' },
];

const NavBar: React.FC<NavBarProps> = ({ activeView, onChange }) => (
  <nav className="flex items-center gap-1 bg-gray-900 border-b border-gray-700 px-4 py-2 overflow-x-auto shrink-0">
    <span className="text-white font-bold text-sm mr-4 whitespace-nowrap">Epstein Graph</span>
    {TABS.map(tab => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`px-3 py-1.5 rounded text-sm whitespace-nowrap transition-colors ${
          activeView === tab.id
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-white hover:bg-gray-800'
        }`}
      >
        {tab.label}
      </button>
    ))}
  </nav>
);

export default NavBar;
