import { useState, useEffect, useCallback } from 'react';
import NetworkGraph from './components/NetworkGraph';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import MobileBottomNav from './components/MobileBottomNav';
import { WelcomeModal } from './components/WelcomeModal';
import NavBar from './components/NavBar';
import LandingPage from './components/LandingPage';
import TransitionScreen from './components/TransitionScreen';
import type { ViewName } from './components/NavBar';
import SNADashboard from './components/SNADashboard';
import CentralityView from './components/CentralityView';
import CommunityView from './components/CommunityView';
import PersonProfile from './components/PersonProfile';
import PathFinder from './components/PathFinder';
import { fetchStats, fetchRelationships, fetchActorRelationships, fetchTagClusters, fetchActorCounts } from './api';
import type { Stats, Relationship, TagCluster } from './types';

function App() {
  const isMobile = window.innerWidth < 1024;

  // SNA navigation state
  const [activeView, setActiveView] = useState<ViewName>('landing');
  const [profileNodeId, setProfileNodeId] = useState<string | null>(null);
  const [profileCommunityId, setProfileCommunityId] = useState<number | null>(null);

  // Explorer state (existing)
  const [stats, setStats] = useState<Stats | null>(null);
  const [tagClusters, setTagClusters] = useState<TagCluster[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [totalBeforeLimit, setTotalBeforeLimit] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedActor, setSelectedActor] = useState<string | null>(null);
  const [actorRelationships, setActorRelationships] = useState<Relationship[]>([]);
  const [actorTotalBeforeFilter, setActorTotalBeforeFilter] = useState<number>(0);
  const [limit, setLimit] = useState(isMobile ? 5000 : 9600);
  const [maxHops, setMaxHops] = useState<number | null>(3);
  const [minDensity, setMinDensity] = useState(50);
  const [enabledClusterIds, setEnabledClusterIds] = useState<Set<number>>(new Set());
  const [enabledCategories, setEnabledCategories] = useState<Set<string>>(new Set());
  const [yearRange, setYearRange] = useState<[number, number]>([1980, 2025]);
  const [includeUndated, setIncludeUndated] = useState(false);
  const [keywords, setKeywords] = useState('');
  const [actorTotalCounts, setActorTotalCounts] = useState<Record<string, number>>({});
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('hasSeenWelcome'));
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const [clusters, statsData] = await Promise.all([fetchTagClusters(), fetchStats()]);
        queueMicrotask(() => {
          setTagClusters(clusters);
          setEnabledClusterIds(new Set(clusters.map(c => c.id)));
          setStats(statsData);
          setEnabledCategories(new Set(statsData.categories.map(c => c.category)));
          setIsInitialized(true);
        });
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };
    initializeApp();
  }, []);

  useEffect(() => {
    if (isInitialized) loadData();
  }, [isInitialized, limit, enabledClusterIds, enabledCategories, yearRange, includeUndated, keywords, maxHops]);

  const loadData = async () => {
    try {
      setLoading(true);
      const clusterIds = Array.from(enabledClusterIds);
      const categories = Array.from(enabledCategories);
      const [relationshipsResponse, actorCounts] = await Promise.all([
        fetchRelationships(limit, clusterIds, categories, yearRange, includeUndated, keywords, maxHops),
        fetchActorCounts(300),
      ]);
      setRelationships(relationshipsResponse.relationships);
      setTotalBeforeLimit(relationshipsResponse.totalBeforeLimit);
      setActorTotalCounts(actorCounts);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActorClick = useCallback((actorName: string) => {
    setSelectedActor(prev => prev === actorName ? null : actorName);
  }, []);

  const toggleCluster = useCallback((clusterId: number) => {
    setEnabledClusterIds(prev => {
      const next = new Set(prev);
      if (next.has(clusterId)) next.delete(clusterId); else next.add(clusterId);
      return next;
    });
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setEnabledCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
  }, []);

  const handleCloseWelcome = useCallback(() => {
    localStorage.setItem('hasSeenWelcome', 'true');
    setShowWelcome(false);
  }, []);

  useEffect(() => {
    if (!selectedActor) { setActorRelationships([]); setActorTotalBeforeFilter(0); return; }
    const load = async () => {
      try {
        const clusterIds = Array.from(enabledClusterIds);
        const categories = Array.from(enabledCategories);
        const response = await fetchActorRelationships(selectedActor, clusterIds, categories, yearRange, includeUndated, keywords, maxHops);
        setActorRelationships(response.relationships);
        setActorTotalBeforeFilter(response.totalBeforeFilter);
      } catch { setActorRelationships([]); setActorTotalBeforeFilter(0); }
    };
    load();
  }, [selectedActor, enabledClusterIds, enabledCategories, yearRange, includeUndated, keywords, maxHops]);

  // Transition state
  type TransitionTarget =
    | { type: 'explorer'; keyword: string }
    | { type: 'person'; nodeId: string };
  const [transition, setTransition] = useState<{ label: string; target: TransitionTarget } | null>(null);

  const goToExplorerWithKeyword = (keyword: string) => {
    const label = keyword ? keyword.charAt(0).toUpperCase() + keyword.slice(1) : 'Document Explorer';
    setTransition({ label, target: { type: 'explorer', keyword } });
  };

  const goToPersonWithTransition = (id: string, name: string) => {
    setTransition({ label: name, target: { type: 'person', nodeId: id } });
  };

  const handleTransitionDone = () => {
    if (transition) {
      if (transition.target.type === 'explorer') {
        setKeywords(transition.target.keyword);
        setActiveView('explorer');
      } else {
        setProfileNodeId(transition.target.nodeId);
        setActiveView('person' as ViewName);
      }
      setTransition(null);
    }
  };

  const goToExplorerWithActor = (actorName: string) => {
    // Reset all filters to defaults before opening explorer
    setKeywords('');
    setYearRange([1980, 2025]);
    setIncludeUndated(false);
    setMaxHops(3);
    setLimit(isMobile ? 5000 : 9600);
    if (tagClusters.length > 0) setEnabledClusterIds(new Set(tagClusters.map(c => c.id)));
    if (stats) setEnabledCategories(new Set(stats.categories.map(c => c.category)));
    setSelectedActor(actorName);
    setActiveView('explorer');
  };

  // SNA navigation helpers
  const goToPerson = (id: string) => {
    setProfileNodeId(id);
    setActiveView('person' as ViewName);
  };
  const goToCommunity = (id: number) => {
    setProfileCommunityId(id);
    setActiveView('communities');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {transition && (
        <TransitionScreen label={transition.label} onDone={handleTransitionDone} />
      )}
      <NavBar activeView={activeView} onChange={setActiveView} />

      {/* Landing Page */}
      {activeView === 'landing' && (
        <div className="flex-1 overflow-y-auto">
          <LandingPage
            onPersonClick={goToPerson}
            onExplorerClick={() => goToExplorerWithKeyword('')}
            onDocTypeClick={goToExplorerWithKeyword}
            onSeeAllClick={() => setActiveView('centrality')}
          />
        </div>
      )}

      {/* Document Explorer (original app) */}
      {activeView === 'explorer' && (
        <div className="flex flex-1 overflow-hidden">
          <div className="hidden lg:block">
            <Sidebar
              stats={stats}
              selectedActor={selectedActor}
              onActorSelect={setSelectedActor}
              limit={limit}
              onLimitChange={setLimit}
              maxHops={maxHops}
              onMaxHopsChange={setMaxHops}
              minDensity={minDensity}
              onMinDensityChange={setMinDensity}
              tagClusters={tagClusters}
              enabledClusterIds={enabledClusterIds}
              onToggleCluster={toggleCluster}
              enabledCategories={enabledCategories}
              onToggleCategory={toggleCategory}
              yearRange={yearRange}
              onYearRangeChange={setYearRange}
              includeUndated={includeUndated}
              onIncludeUndatedChange={setIncludeUndated}
              keywords={keywords}
              onKeywordsChange={setKeywords}
            />
          </div>
          <div className="flex-1 relative pb-16 lg:pb-0">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4" />
                  <p className="text-gray-400">Loading network data...</p>
                </div>
              </div>
            ) : (
              <NetworkGraph
                relationships={relationships}
                selectedActor={selectedActor}
                onActorClick={handleActorClick}
                minDensity={minDensity}
                actorTotalCounts={actorTotalCounts}
              />
            )}
          </div>
          {selectedActor && (
            <div className="hidden lg:block">
              <RightSidebar
                selectedActor={selectedActor}
                relationships={actorRelationships}
                totalRelationships={actorTotalBeforeFilter}
                onClose={() => setSelectedActor(null)}
                yearRange={yearRange}
              />
            </div>
          )}
          <div className="lg:hidden">
            <MobileBottomNav
              stats={stats}
              selectedActor={selectedActor}
              onActorSelect={setSelectedActor}
              limit={limit}
              onLimitChange={setLimit}
              tagClusters={tagClusters}
              enabledClusterIds={enabledClusterIds}
              onToggleCluster={toggleCluster}
              enabledCategories={enabledCategories}
              onToggleCategory={toggleCategory}
              relationships={selectedActor ? actorRelationships : relationships}
            />
          </div>
          <WelcomeModal isOpen={showWelcome} onClose={handleCloseWelcome} />
        </div>
      )}

      {/* SNA Dashboard */}
      {activeView === 'dashboard' && (
        <div className="flex-1 overflow-hidden">
          <SNADashboard onPersonClick={goToPerson} onCommunityClick={goToCommunity} />
        </div>
      )}

      {/* Centrality */}
      {activeView === 'centrality' && (
        <div className="flex-1 overflow-hidden">
          <CentralityView onPersonClick={goToPerson} />
        </div>
      )}

      {/* Communities */}
      {activeView === 'communities' && (
        <div className="flex-1 overflow-hidden">
          <CommunityView
            initialCommunityId={profileCommunityId}
            onPersonClick={goToPerson}
          />
        </div>
      )}

      {/* Person Profile */}
      {activeView === 'person' && profileNodeId && (
        <div className="flex-1 overflow-hidden">
          <PersonProfile
            key={profileNodeId}
            nodeId={profileNodeId}
            onBack={() => setActiveView('dashboard')}
            onPersonClick={goToPersonWithTransition}
            onCommunityClick={goToCommunity}
            onMentionsClick={goToExplorerWithActor}
          />
        </div>
      )}

      {/* Path Finder */}
      {activeView === 'path' && (
        <div className="flex-1 overflow-hidden">
          <PathFinder onPersonClick={goToPerson} />
        </div>
      )}
    </div>
  );
}

export default App;
