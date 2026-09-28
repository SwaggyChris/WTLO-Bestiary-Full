import { useEffect, useState } from 'react';
import { getMonsterImage } from '../lib/bestiaryUtils.js';

export default function ImageView({ entry, className = '', placeholderClassName = 'media-placeholder' }) {
  const [failed, setFailed] = useState(false);
  const src = getMonsterImage(entry);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return <span className={placeholderClassName}><i className="fas fa-paw" /></span>;
  }

  return (
    <img
      className={className}
      src={src}
      alt={entry?.name || 'Monster'}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
