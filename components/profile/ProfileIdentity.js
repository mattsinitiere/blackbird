import { PlayerBadge, TagPill, GearIcon } from "../ui";
import { PinIcon, CalendarIcon, EditIcon } from "./icons";
import FollowButton from "./FollowButton";
import ShareButton from "./ShareButton";

function sinceLabel(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/**
 * Avatar (overlapping the cover), name, @handle, bio and details, social
 * counts and the actions. Editing is only ever offered on your own
 * profile; follower counts only where the database lets us see them.
 */
export default function ProfileIdentity({ user, player, playerColors, isMe, follow, followsYou, counts, onOpenFriends, onEditProfile, onOpenAccount }) {
  const since = sinceLabel(player?.createdAt);
  return (
    <div className="pf-id">
      <div className="pf-id-top">
        <span className="pf-avatar">
          <PlayerBadge username={user} color={playerColors?.[user]} sizeCss="var(--pf-av)" showName={false} />
        </span>
        <div className="pf-actions">
          {isMe ? (
            <>
              {onEditProfile && (
                <button type="button" className="btn btn-sm btn-primary pf-action" onClick={onEditProfile}>
                  <EditIcon /> Edit profile
                </button>
              )}
              <ShareButton player={player} user={user} />
              {onOpenAccount && (
                <button type="button" className="btn btn-sm pf-action pf-icon-btn" onClick={onOpenAccount} title="Settings" aria-label="Settings">
                  <GearIcon />
                </button>
              )}
            </>
          ) : (
            <>
              <FollowButton user={user} {...follow} />
              <ShareButton player={player} user={user} />
            </>
          )}
        </div>
      </div>

      <h1 className="pf-name">
        <span>{user}</span>
        {(player?.tag || player?.tagIcon) && <TagPill tag={player.tag} tagIcon={player.tagIcon} />}
      </h1>
      <div className="pf-handle-row">
        {player?.handle && <span className="pf-handle">@{player.handle}</span>}
        {!isMe && followsYou && <span className="pf-follows-you">Follows you</span>}
      </div>
      {player?.bio && <p className="pf-bio">{player.bio}</p>}
      {(player?.location || since) && (
        <div className="pf-meta">
          {player?.location && (
            <span>
              <PinIcon /> {player.location}
            </span>
          )}
          {since && (
            <span>
              <CalendarIcon /> Member Since {since}
            </span>
          )}
        </div>
      )}
      {counts && (
        <div className="pf-counts">
          <button type="button" className="pf-count" onClick={onOpenFriends}>
            <span className="num">{counts.following}</span> Following
          </button>
          <button type="button" className="pf-count" onClick={onOpenFriends}>
            <span className="num">{counts.followers}</span> {counts.followers === 1 ? "Follower" : "Followers"}
          </button>
        </div>
      )}
    </div>
  );
}
