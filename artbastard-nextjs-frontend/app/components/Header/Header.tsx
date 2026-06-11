"use client"; // Header is interactive, uses Link, likely a client component

import Link from 'next/link';
import styles from './Header.module.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb, faTachometerAlt, faSlidersH, faTheaterMasks, faCog, faBolt } from '@fortawesome/free-solid-svg-icons';

const Header = () => {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <Link href="/">
          <FontAwesomeIcon icon={faBolt} className={styles.logoIcon} />
          ArtBastard NEXT
        </Link>
      </div>
      <nav className={styles.nav}>
        <Link href="/"><FontAwesomeIcon icon={faTachometerAlt} /> Dashboard</Link>
        <Link href="/dmx"><FontAwesomeIcon icon={faSlidersH} /> DMX</Link>
        <Link href="/fixtures"><FontAwesomeIcon icon={faLightbulb} /> Fixtures</Link>
        <Link href="/scenes"><FontAwesomeIcon icon={faTheaterMasks} /> Scenes</Link>
        <Link href="/settings"><FontAwesomeIcon icon={faCog} /> Settings</Link>
      </nav>
    </header>
  );
};

export default Header;
