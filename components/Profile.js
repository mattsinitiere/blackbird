import { useState, useEffect, useMemo } from "react";
import { BackBar, Mini } from "./ui";
import AchievementsCard from "./Achievements";
import { computeCareer } from "@/lib/gamestats/career";
import { computeAchievements, readSeen, writeSeen, seenKey } from "@/lib/achievements";
import { playerTimeline, rivalry, computeStats } from "@/lib/stats";
import { openingPeriod, lastPlayed, periodBounds, filterByPeriod, inPeriod } from "@/lib/period";
import { computePracticeStats, practiceCounts, practiceAsMatches } from "@/lib/practiceStats";
import { prepareGames, x01Opponents } from "@/lib/deepStats";
import DeepStats from "./profile/DeepStats";
import { matchFeed, achievementFeed, mergeFeed, circleFor } from "@/lib/activity";
import ProfileCover from "./profile/ProfileCover";
import ProfileIdentity from "./profile/ProfileIdentity";
import ProfileTabs from "./profile/ProfileTabs";
import ActivityFeed from "./profile/ActivityFeed";
import ProfileSidebar from "./profile/ProfileSidebar";
import ProfileStats from "./profile/ProfileStats";
import RivalryCard from "./profile/RivalryCard";

/**
 * A player's profile, laid out like a social profile: cover, identity and
 * tabs (Activity, Statistics, Achievements) in the main column, and a
 * sidebar with their game, trophy cabinet and circle. Everything comes
 * from the rows the app already holds; nothing here is invented.
 *
 * What we can see is limited by the database: result rows exist only for
 * you and the players you follow, and follows only where you are one side
 * of them. So another player's follower counts are never shown, and an
 * unfollowed player's profile says why it is empty instead of showing zeros.
 */
export default function Profile({
  user,
  me = null,
  player,
  stats,
  elo,
  results,
  practice = [],
  onOpenPractice,
  onOpenAccount,
  onEditProfile = null,
  back,
  playerColors,
  isMe,
  isFollowing,
  onFollow,
  onUnfollow,
  followsYou = false,
  social = null,
  socialAvailable = false,
  dataError = false,
  userId = null,
  openGame = null,
  openProfile = null,
  onOpenFriends = null,
  onAskAI = null,
}) {
  const [tab, setTab] = useState("activity");
  // Statistics tab: ranked games or practice games
  const [statsMode, setStatsMode] = useState("ranked");
  const openPracticeStats = () => {
    setStatsMode("practice");
    setTab("stats");
  };
  const follow = { isFollowing, onFollow, onUnfollow };

  const career = useMemo(() => computeCareer({ results, practice }, user), [results, practice, user]);
  // badges are derived from the rows we can see; another player's follows
  // are private, so their social badges are left out
  const badges = useMemo(() => computeAchievements({ me: user, results, practice, social: isMe ? social : null }), [user, results, practice, isMe, social]);
  const [seen, setSeen] = useState(() => new Set());
  useEffect(() => {
    if (!isMe || typeof window === "undefined") return;
    const key = seenKey(userId);
    setSeen(readSeen(window.localStorage, key));
    // after a moment, everything unlocked counts as seen (the "New" chips show once)
    const t = setTimeout(() => writeSeen(window.localStorage, key, [...readSeen(window.localStorage, key), ...badges.filter((b) => b.unlocked).map((b) => b.id)]), 4000);
    return () => clearTimeout(t);
  }, [isMe, userId, badges]);

  const myPractice = useMemo(() => practice.filter((r) => r.username === user), [practice, user]);
  const lastPractice = useMemo(() => lastPlayed(myPractice), [myPractice]);

  // Statistics tab: a date range. Until one is picked it opens on the
  // shortest range that holds a ranked game (30 days, 90 days, All Time),
  // so a month off doesn't open on an empty page
  const myRanked = useMemo(() => results.filter((r) => r.username === user), [results, user]);
  const lastRanked = useMemo(() => lastPlayed(myRanked), [myRanked]);
  const [pickedPeriod, setPeriod] = useState(null);
  const period = pickedPeriod || openingPeriod(myRanked);
  const [custom, setCustom] = useState({ from: "", to: "" });
  const bounds = useMemo(() => periodBounds(period, new Date(), custom), [period, custom]);
  const pResults = useMemo(() => filterByPeriod(results, bounds), [results, bounds]);
  const pPractice = useMemo(() => filterByPeriod(practice, bounds), [practice, bounds]);
  const pStats = useMemo(() => (period === "all" ? stats : computeStats(pResults)[user] || null), [period, stats, pResults, user]);
  const pTimeline = useMemo(() => (pStats ? playerTimeline(pResults, user) : null), [pStats, pResults, user]);
  const pCareer = useMemo(() => computeCareer({ results: pResults, practice: pPractice }, user), [pResults, pPractice, user]);
  const pMyPractice = useMemo(() => pPractice.filter((r) => r.username === user), [pPractice, user]);
  // practice shown like ranked play: counts for the header, stats for the range
  const practiceCount = useMemo(() => practiceCounts(myPractice, user), [myPractice, user]);
  // the Practice view keeps its own date range and opens on All Time:
  // practice comes in bursts, so a 30-day window is often empty
  const [practicePeriod, setPracticePeriod] = useState("all");
  const [practiceCustom, setPracticeCustom] = useState({ from: "", to: "" });
  const practiceBounds = useMemo(() => periodBounds(practicePeriod, new Date(), practiceCustom), [practicePeriod, practiceCustom]);
  const rMyPractice = useMemo(() => filterByPeriod(myPractice, practiceBounds), [myPractice, practiceBounds]);
  const pPracticeStats = useMemo(() => computePracticeStats(rMyPractice, user), [rMyPractice, user]);
  // deeper stats: every game analyzed once, then narrowed to the date range
  const rankedGames = useMemo(() => prepareGames(results, user), [results, user]);
  const practiceGames = useMemo(() => prepareGames(practiceAsMatches(myPractice, user), user), [myPractice, user]);
  const pRankedGames = useMemo(() => rankedGames.filter((g) => inPeriod(g.row.completedAt, bounds)), [rankedGames, bounds]);
  const rPracticeGames = useMemo(() => practiceGames.filter((g) => inPeriod(g.row.completedAt, practiceBounds)), [practiceGames, practiceBounds]);
  const opponents = useMemo(() => x01Opponents([...results, ...practice], user), [results, practice, user]);
  // mirrors ProfileStats: a player with only practice games lands on Practice
  const practiceView = myPractice.length > 0 && (statsMode === "practice" || !stats);
  const practiceLine = [
    practiceCount.games > 0 && `${practiceCount.games} practice ${practiceCount.games === 1 ? "game" : "games"}`,
    practiceCount.drills > 0 && `${practiceCount.drills} ${practiceCount.drills === 1 ? "drill" : "drills"}`,
  ].filter(Boolean).join(" · ");
  const timeline = useMemo(() => (stats ? playerTimeline(results, user) : null), [stats, results, user]);
  const feed = useMemo(() => mergeFeed(matchFeed(results, user), achievementFeed(badges)), [results, user, badges]);
  const circle = useMemo(
    () => circleFor({ user, isMe: !!isMe, results, following: isMe ? (socialAvailable ? social?.following || [] : []) : null }),
    [user, isMe, results, social, socialAvailable]
  );
  // you vs them, from your own rows (exact even when you don't follow them)
  const rv = useMemo(() => (!isMe && me ? rivalry(results, me, user) : null), [isMe, me, results, user]);

  const theirRowsVisible = !!stats || myPractice.length > 0 || results.some((r) => r.username === user);
  const hidden = !isMe && !theirRowsVisible && isFollowing === false;
  const unavailable = dataError ? "Stats couldn't load. Pull to refresh or try again shortly." : hidden ? `Follow ${user} to see their games.` : null;
  const counts = isMe && socialAvailable && social ? { following: social.following?.length || 0, followers: social.followers?.length || 0 } : null;

  let feedEmpty;
  if (dataError) feedEmpty = <p className="card pf-empty-card">{unavailable}</p>;
  else if (hidden)
    feedEmpty = (
      <div className="card pf-empty-card">
        <p className="pf-empty-title">Follow {user} to see their activity</p>
        <p className="pf-empty">Players share their games with the people who follow them.</p>
      </div>
    );
  else if (myPractice.length > 0)
    feedEmpty = (
      <div className="card pf-empty-card">
        <p className="pf-empty-title">No ranked matches yet</p>
        <p className="pf-empty">
          {myPractice.length} practice {myPractice.length === 1 ? "session is" : "sessions are"} logged under Statistics. Practice, bot games and drills never count toward ranked stats.
        </p>
        <button type="button" className="btn btn-sm" onClick={openPracticeStats}>
          See practice
        </button>
      </div>
    );
  else
    feedEmpty = (
      <div className="card pf-empty-card">
        <p className="pf-empty-title">No matches yet</p>
        <p className="pf-empty">{isMe ? "Finished ranked games and achievements you unlock will show up here." : `${user} hasn't played a ranked game yet.`}</p>
      </div>
    );

  const circleNote = isMe
    ? !socialAvailable
      ? "Friends aren't switched on for this database yet."
      : "You don't follow anyone yet."
    : hidden
    ? `Follow ${user} to see who they play.`
    : "No ranked opponents yet.";

  const rivalryCard = rv && rv.games > 0 ? <RivalryCard user={user} rv={rv} /> : null;
  const sidebar = (
    <ProfileSidebar
      user={user}
      isMe={!!isMe}
      stats={stats}
      elo={elo}
      timeline={timeline}
      badges={badges}
      circle={circle}
      circleNote={circleNote}
      playerColors={playerColors}
      openProfile={openProfile}
      onOpenFriends={isMe ? onOpenFriends : null}
      setTab={setTab}
      unavailable={unavailable}
      practiceCount={practiceCount}
      onOpenPracticeStats={openPracticeStats}
    />
  );

  return (
    <div className="fade pf">
      <BackBar back={back} />
      <div className="pf-layout">
        <div className="pf-main">
          <section className="card pf-head" aria-label={`${user}'s profile`}>
            <ProfileCover cover={player?.cover} />
            <ProfileIdentity
              user={user}
              player={player}
              playerColors={playerColors}
              isMe={!!isMe}
              follow={follow}
              followsYou={followsYou}
              counts={counts}
              onOpenFriends={onOpenFriends}
              onEditProfile={isMe ? onEditProfile : null}
              onOpenAccount={isMe ? onOpenAccount : null}
            />
            {stats && (
              <div className="pf-strip" aria-label="All-time ranked summary">
                <Mini label="Elo" value={Math.round(elo || 1000)} />
                <Mini label="3-dart avg" value={stats.x01.darts > 0 ? stats.x01.threeDartAvg.toFixed(1) : "—"} />
                <Mini label="Win %" value={stats.winPct.toFixed(0)} />
                <Mini label="Matches" value={stats.games} />
              </div>
            )}
            {stats && practiceLine && (
              <button type="button" className="pf-practice-line" onClick={openPracticeStats} aria-label={`${practiceLine}. Open practice statistics`}>
                <span>
                  <strong className="num">{practiceLine}</strong> · not ranked
                </span>
                <span className="pf-practice-go">Practice stats</span>
              </button>
            )}
            <ProfileTabs tab={tab} setTab={setTab} />
          </section>

          <div role="tabpanel" id={`pf-panel-${tab}`} aria-labelledby={`pf-tab-${tab}`} className="pf-panel" tabIndex={-1}>
            {tab === "activity" && (
              <ActivityFeed
                items={feed}
                user={user}
                isMe={!!isMe}
                seen={seen}
                playerColors={playerColors}
                openGame={openGame}
                empty={feedEmpty}
                lead={rivalryCard}
              />
            )}
            {tab === "stats" && (
              <ProfileStats
                onAskAI={isMe ? onAskAI : null}
                user={user}
                player={player}
                stats={pStats}
                allStats={stats}
                elo={elo}
                timeline={pTimeline}
                career={pCareer}
                practiceRows={practiceView ? rMyPractice : pMyPractice}
                practiceStats={pPracticeStats}
                deepRanked={<DeepStats user={user} isMe={!!isMe} games={pRankedGames} opponents={opponents} />}
                deepPractice={<DeepStats user={user} isMe={!!isMe} games={rPracticeGames} opponents={opponents} practice rankedAll={rankedGames} practiceAll={practiceGames} />}
                practiceGames={practiceCount.games}
                hasPractice={myPractice.length > 0}
                mode={statsMode}
                onMode={setStatsMode}
                lastGame={practiceView ? lastPractice : lastRanked}
                period={practiceView ? practicePeriod : period}
                bounds={practiceView ? practiceBounds : bounds}
                custom={practiceView ? practiceCustom : custom}
                onPeriod={practiceView ? setPracticePeriod : setPeriod}
                onCustom={practiceView ? setPracticeCustom : setCustom}
                onOpenPractice={onOpenPractice}
                openGame={openGame}
                playerColors={playerColors}
                rivalryCard={rivalryCard}
                empty={
                  <div className="card pf-empty-card mb-12">
                    <p className="pf-empty">{unavailable || (myPractice.length ? "No ranked games yet. Practice is below." : "No games logged yet.")}</p>
                  </div>
                }
              />
            )}
            {tab === "achievements" && (
              <>
                {badges.some((b) => b.unlocked) || !unavailable ? (
                  <AchievementsCard badges={badges} isMe={!!isMe} seen={seen} />
                ) : (
                  <p className="card pf-empty-card">{unavailable}</p>
                )}
                {!isMe && <p className="pf-empty pf-note">Badges that depend on who someone follows are private and only show on their own profile.</p>}
              </>
            )}
          </div>
        </div>

        <aside className={`pf-side${tab === "activity" ? "" : " pf-side-wide-only"}`} aria-label="Profile summary">
          {sidebar}
        </aside>
      </div>
    </div>
  );
}
