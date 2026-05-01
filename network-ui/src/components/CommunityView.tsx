import React, { useEffect, useState } from 'react';
import { snaApi } from '../sna-api';
import type { SnaCommunity, SnaNode } from '../sna-api';

// Keyed by original Louvain community ID (stable, independent of display label)
const COMMUNITY_DESCRIPTIONS: Record<number, string> = {
  4:  'Epstein\'s core personal network. The central hub — Jeffrey Epstein, Ghislaine Maxwell, lawyers, close associates, and figures appearing most frequently across all documents.',
  11: 'International political leadership. Ehud Barak, Bill Clinton, Barack Obama, Benjamin Netanyahu — world leaders connected through Epstein\'s political and diplomatic relationships.',
  0:  'Trump political orbit. Donald Trump, Steve Bannon, Jared Kushner, Hillary Clinton, and the political figures who appear in Epstein documents alongside U.S. domestic politics.',
  3:  'Anonymous witnesses and law enforcement. Unidentified victims, witnesses, and detectives (including Detective Recarey) referenced in depositions and police investigation files.',
  12: 'Legal proceedings and abuse allegations. Alan Dershowitz, Virginia Giuffre, Bradley Edwards, FBI, and the civil litigation and criminal filings documenting the abuse network.',
  2:  'NSA surveillance and whistleblowing. Edward Snowden, Glenn Greenwald, Laura Poitras, and the journalists and intelligence agencies connected through NSA leak documents.',
  9:  'Financial research and markets. Bank of America, Morgan Stanley, and institutional finance appearing in Epstein-linked financial documents and research reports.',
  10: 'Trafficking and international crime. Jean-Luc Brunel, victim references, and connections to international figures in the context of trafficking allegations.',
  6:  'Intellectual and technology elite. Figures from Epstein\'s academic philanthropy — John Brockman, Danny Hillis, and scientists connected through the Edge Foundation and MIT Media Lab.',
  16: 'Palm Beach law enforcement and prosecution. Palm Beach PD, Chief Reiter, Barry Krischer, and the grand jury proceedings that led to Epstein\'s 2008 plea deal.',
  5:  'Financial and private equity. Michael Milken and entities from Epstein\'s financial dealings, including private investment vehicles and business associates.',
  17: 'Media and entertainment circles. Peggy Siegal, Graydon Carter, Vanity Fair, Harvey Weinstein — the New York media elite connected to Epstein socially.',
  18: 'Countercultural press. Paul Krassner, Lenny Bruce, the New York Times — journalists and publications connected to investigative coverage and historical context.',
  7:  'JP Morgan and investment banking. Jes Staley, Michael Cembalest, and Epstein\'s banking relationships, particularly with JP Morgan\'s private wealth division.',
  15: 'Deposition witnesses. Anonymous and named deponents appearing in civil case transcripts and legal proceedings.',
  19: 'Academic skeptics. Lawrence Krauss, Noam Chomsky, Rebecca Watson — scientists and public intellectuals whose connections to Epstein funding were scrutinized.',
  26: 'Technology and venture capital. MIT, John Maeda, Mary Meeker — the tech world that intersected with Epstein\'s Media Lab philanthropy.',
  21: 'Film and documentary. Bill Siegel and figures connected to documentary coverage of Epstein-adjacent political topics.',
  30: 'Business associates. IBM and individuals connected through Epstein\'s corporate dealings and financial network.',
  39: 'Political figures and victims\' advocates. Diana DeGette, Chelsea Clinton, and figures appearing in congressional and advocacy documents.',
};

interface CommunityViewProps {
  initialCommunityId?: number | null;
  onPersonClick: (id: string) => void;
}

const CommunityCard: React.FC<{
  community: SnaCommunity;
  onPersonClick: (id: string) => void;
}> = ({ community, onPersonClick }) => {
  const [members, setMembers] = useState<SnaNode[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const description = COMMUNITY_DESCRIPTIONS[community.id];

  const load = () => {
    if (!loaded) {
      snaApi.communityMembers(community.id).then(m => {
        setMembers(m);
        setLoaded(true);
      });
    }
    setExpanded(e => !e);
  };

  const shown = expanded ? members : members.slice(0, 5);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="w-4 h-4 rounded shrink-0" style={{ background: community.color }} />
        <h3 className="font-semibold text-white">{community.label}</h3>
        <span className="text-gray-400 text-sm ml-auto">{community.size} members</span>
      </div>

      {description && (
        <p className="text-slate-400 text-xs mb-3 leading-relaxed">{description}</p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-2">
        {shown.map(m => (
          <button
            key={m.id}
            onClick={() => onPersonClick(m.id)}
            className="px-2 py-0.5 text-xs rounded-full border border-gray-600 hover:border-gray-400 hover:bg-gray-700 transition-colors text-gray-300"
          >
            {m.name}
          </button>
        ))}
      </div>

      <button
        onClick={load}
        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
      >
        {!loaded ? 'Load members' : expanded ? 'Show fewer' : `Show all ${community.size}`}
      </button>
    </div>
  );
};

const CommunityView: React.FC<CommunityViewProps> = ({ initialCommunityId, onPersonClick }) => {
  const [communities, setCommunities] = useState<SnaCommunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    snaApi.communities()
      .then(setCommunities)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-gray-400">Loading communities...</div>;

  return (
    <div className="p-6 overflow-y-auto h-full text-white">
      <h1 className="text-2xl font-bold mb-2">Communities</h1>
      <p className="text-gray-400 text-sm mb-6">
        Detected via Louvain algorithm — {communities.length} communities from {communities.reduce((s, c) => s + c.size, 0)} nodes.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {communities.map(c => (
          <CommunityCard
            key={c.id}
            community={c}
            onPersonClick={onPersonClick}
          />
        ))}
      </div>
    </div>
  );
};

export default CommunityView;
