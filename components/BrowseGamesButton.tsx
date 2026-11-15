'use client';

// "Browse Games →": glides down to Game Offers (instead of jumping) and replays the cards' fade-up.
// Done here rather than with CSS `scroll-behavior: smooth` so normal page changes still start at the top instantly.
export default function BrowseGamesButton() {
  function go(e: React.MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById('games');
    if (!target) return; // fall back to the plain #games jump
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', '#games');
    if (!reduce) {
      target.classList.remove('games-reveal');
      void target.offsetWidth; // restart the animation if clicked again
      target.classList.add('games-reveal');
    }
  }
  return (
    <a href="#games" className="btn-primary" onClick={go}>Browse Games →</a>
  );
}
