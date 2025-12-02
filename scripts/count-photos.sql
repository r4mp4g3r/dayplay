SELECT COUNT(*) as total_photos,
       COUNT(CASE WHEN url LIKE '%AIzaSyBbCR_QIZycV8cCVBAVjxwAJ7FrO8Q4yNU%' THEN 1 END) as old_key_photos,
       COUNT(CASE WHEN url LIKE '%AIzaSyAGyibUGCrF0_e5fiUuNlGYiATtBekgTLk%' THEN 1 END) as new_key_photos
FROM listing_photos
WHERE url LIKE '%maps.googleapis.com%';
