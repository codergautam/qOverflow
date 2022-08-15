function msToTime(duration) {
    const portions = [];

    const msInYear = 1000 * 60 * 60 * 24 * 365;
    const years = Math.trunc(duration / msInYear);

    if (years > 0) {
        portions.push(`${years} year${years > 1 ? 's' : ''}`);
        duration -= years * msInYear;
    }

    const msInMonth = 1000 * 60 * 60 * 24 * 30;
    const months = Math.trunc(duration / msInMonth);
    if (months > 0) {
        portions.push(months + ' month'+(months > 1 ? 's' : ''));
        duration -= months * msInMonth;
    }

      const msInDay = 1000 * 60 * 60 * 24;
    const days = Math.trunc(duration / msInDay);
    if (days > 0) {
      portions.push(days + 'd');
      duration = duration - (days * msInDay);
    }
  
    const msInHour = 1000 * 60 * 60;
    const hours = Math.trunc(duration / msInHour);
    if (hours > 0) {
      portions.push(hours + 'h');
      duration = duration - (hours * msInHour);
    }
  
    const msInMinute = 1000 * 60;
    const minutes = Math.trunc(duration / msInMinute);
    if (minutes > 0) {
      portions.push(minutes + 'm');
      duration = duration - (minutes * msInMinute);
    }
  
    const seconds = Math.trunc(duration / 1000);
    if (seconds > 0) {
      portions.push(seconds + 's');
    }
  
    return portions[0] ? portions[0] : 'Just now';
  }

module.exports = msToTime;