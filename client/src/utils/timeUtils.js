// Format seconds into MM:SS (e.g. 00:07, 01:23)
export function formatTimer(totalSeconds) {
    if (totalSeconds == null || isNaN(totalSeconds) || totalSeconds < 0) {
        return "00:00";
    }
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

// Format seconds into human readable short duration (e.g. 18s, 1m 24s)
export function formatDuration(totalSeconds) {
    if (totalSeconds == null || isNaN(totalSeconds) || totalSeconds <= 0) {
        return "0s";
    }
    if (totalSeconds < 60) {
        return `${totalSeconds}s`;
    }
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}
