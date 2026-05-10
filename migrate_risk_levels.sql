-- Migrate old risk levels (0.1x, 0.2x, 0.3x) to new leverage multipliers (1.x, 1.5x, 2.x)
UPDATE demo_challenges
SET risk_level = CASE
    WHEN risk_level < 0.2 THEN 1.0 + (risk_level - 0.1) * 2.5
    WHEN risk_level < 0.3 THEN 1.5 + (risk_level - 0.2) * 2.5
    ELSE 2.0 + (risk_level - 0.3) * 2.5
END
WHERE risk_level < 1.0;
