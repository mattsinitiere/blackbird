import { useState, useEffect, useMemo } from "react";
import { BackBar, Mini } from "./ui";
import AchievementsCard from "./Achievements";
import { computeCareer } from "@/lib/gamestats/career";
import { computeAchievements, readSeen, writeSeen, seenKey } from "@/lib/achievements";
import { playerTimeline, rivalry, computeStats } from "@/lib/stats";
import { DEFAULT_PERIOD, periodBounds, filterByPeriod } from "@/lib/period";
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

  // Statistics tab: a date range (last 30 days by default)
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [custom, setCustom] = useState({ from: "", to: "" });
  const bounds = useMemo(() => periodBounds(period, new Date(), custom), [period, custom]);
  const pResults = useMemo(() => filterByPeriod(results, bounds), [results, bounds]);
  const pPractice = useMemo(() => filterByPeriod(practice, bounds), [practice, bounds]);
  const pStats = useMemo(() => (period === "all" ? stats : computeStats(pResults)[user] || null), [period, stats, pResults, user]);
  const pTimeline = useMemo(() => (pStats ? playerTimeline(pResults, user) : null), [pStats, pResults, user]);
  const pCareer = useMemo(() => computeCareer({ results: pResults, practice: pPractice }, user), [pResults, pPractice, user]);
  const pMyPractice = useMemo(() => pPractice.filter((r) => r.username === user), [pPractice, user]);
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
        <button type="button" className="btn btn-sm" onClick={() => setTab("stats")}>
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
                practiceRows={pMyPractice}
                period={period}
                bounds={bounds}
                custom={custom}
                onPeriod={setPeriod}
                onCustom={setCustom}
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
