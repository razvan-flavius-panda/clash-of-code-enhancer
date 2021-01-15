// ==UserScript==
// @name        Clash of Code Enhancer
// @namespace   Violentmonkey Scripts
// @match       *://www.codingame.com/*
// @grant       none
// @version     1.0
// @author      Răzvan Flavius Panda
// @description CodinGame Clash of Code enhancer: fair rankings, competition, ...
// @require https://raw.githubusercontent.com/lodash/lodash/4.17.15-npm/lodash.js
// ==/UserScript==
// TODO features / improvements:
// * display tournament round
// * text to speech for timer
// * competition features:
//   - save tournament results
//   - green and red arrow if someone advances in the leaderboard
//   - more advanced statistics
//   - sort by columns (use angularjs?)
//   - vote on quality, type safety, etc.
//   - voting via CoC integrated chat
// * automatically start sync on new clash + click on start clash button
// * automatic invites and twitch/discord share
// * css for winners
// * improve overall design
// * easy way to view code side-by-side
// * save answers locally
// * remove redundancy related to selectors usage
(new MutationObserver(check)).observe(document, { childList: true, subtree: true });
function check(_changes, observer) {
    if (document.querySelector('.player-report')) {
        observer.disconnect();
        var previousFinishedCount = 0;
        update();
        setInterval(update, 3000);
        function update() {
            let $reportContainer = $(".report-container > .content-container");
            let $reports = $reportContainer.children('[ng-repeat]');
            if (_.isEmpty($reports)) {
                location.reload();
            }
            let reports = [];
            $('.player-report').each((_i, obj) => {
                let timeArray = $(obj)
                    .find('div.info-clash.duration > div > div.info-content-container > div.info-value > span')
                    .text()
                    .split(':')
                    .map(s => parseInt(s));
                reports.push({
                    name: $(obj).find('.nickname').text(),
                    rank: parseInt($(obj).find('.clash-rank').text()),
                    score: parseInt($(obj).find('div.info-clash.score > div > div.info-content-container > div.info-value > span').text()),
                    pending: _.isEmpty($(obj).find('.pending-rank')),
                    nickname: $(obj).find('.nickname').text(),
                    language: $(obj).find('div.info-clash.language > div > div.info-content-container > div.info-value > span').text(),
                    time: timeArray[0] * 3600 + timeArray[1] * 60 + timeArray[2],
                    length: parseInt($(obj).find('div.info-clash.criterion > div > div.info-content-container > div.info-value > span').text())
                });
            });
            var finishedCount = _.countBy(reports, report => !isNaN(report.score)).true;
            if (previousFinishedCount === finishedCount)
                return;
            previousFinishedCount = finishedCount;
            let reportsByLanguage = _.groupBy(reports, report => report.language);
            _.forOwn(reportsByLanguage, (reports, language) => {
                _.forEach(reports, (report, idx) => report.fairRank = language === 'N/A' ? NaN : idx + 1);
            });
            let fairReports = _.sortBy(_.flatten(_.map(reportsByLanguage, (reports, _) => reports)), report => report.rank);
            let worstRank = _.max(_.map(_.filter(fairReports, report => report.score > 0), report => report.fairRank));
            _.forEach(fairReports, report => {
                if (report.score === 0) {
                    report.fairRank = (worstRank !== null && worstRank !== void 0 ? worstRank : 0) + 1;
                }
            });
            let reportData = [];
            _(fairReports).forEach(report => {
                reportData.push(_.pick(report, 'name', 'score', 'time', 'length', 'fairRank'));
            });
            let keyPrefix = 'CoC_enhancer_';
            localStorage.setItem(keyPrefix + _.last(location.pathname.split('/')), JSON.stringify(reportData));
            // TODO move outside
            document.addEventListener("keydown", event => {
                if (event.isComposing || event.keyCode === 229) {
                    return;
                }
                if (event.ctrlKey && event.key === 'm') {
                    _.forOwn(localStorage, (value, key) => {
                        if (key.startsWith(keyPrefix)) {
                            localStorage.removeItem(key);
                        }
                    });
                }
            });
            // Leaderboard core input data:
            //   - score = percentage of tests passed, Int, [0..100]
            //   - time = time it took to solve the challenge, Int, [0..MAXtime]
            //   - length = code size in number of characters, Int, [0..MAXlength]
            //   - language = language in which the challenge was solved in
            // Derived inputs:
            //   - rank = position in CoC without this userscript, Int, [1..MAXrank]
            //   - fair rank = position in each group per language, Int, [1..MAXfairRank]
            // lopidav suggested: https://gist.github.com/lopidav/4ae1c8c1382802c5cf4f40c6e933bbc2
            // TODO normalize points per language group in shortest mode
            function getLeaderboardPoints(score, time, length, fairRank) {
                let isShortestMode = !isNaN(length);
                let points = isShortestMode
                    ? score / (time * fairRank)
                    : score / time;
                return isNaN(points) ? 0 : Math.round(100 * points);
            }
            let leaderboard = [];
            _.forOwn(localStorage, (value, key) => {
                if (key.startsWith(keyPrefix)) {
                    let reports = JSON.parse(value);
                    let maxPointsThisGame = _(reports).map(report => getLeaderboardPoints(report.score, report.time, report.length, report.fairRank)).max();
                    _(reports).forEach((report) => {
                        let playerInfo = _(leaderboard).find(player => player.name === report.name);
                        let points = Math.round(100 * getLeaderboardPoints(report.score, report.time, report.length, report.fairRank) / maxPointsThisGame);
                        if (playerInfo) {
                            playerInfo.points += points;
                            playerInfo.gamesCount += 1;
                        }
                        else {
                            leaderboard.push({
                                name: report.name,
                                points,
                                gamesCount: 1
                            });
                        }
                    });
                }
                ;
            });
            $('#leaderboard').remove();
            var table = "<br/><table id='leaderboard' style='font-family:monospace;margin:auto'>"
                + '<tr><td>Position</td><td>Name</td><td>Points total</td><td>Points this game</td><td>Points average per game</td><td>Games</td></tr>';
            _(leaderboard)
                .sortBy(_ => _.points)
                .reverse()
                .forEach((playerInfo, index) => {
                let report = _(fairReports).find(_ => _.name === playerInfo.name);
                table += '<tr><td>' + index + '</td><td>'
                    + playerInfo.name + '</td><td>'
                    + playerInfo.points + '</td><td>'
                    // FIXME normalize
                    + (report ? getLeaderboardPoints(report.score, report.time, report.length, report.fairRank) : "N/A") + '</td><td>'
                    + Math.round(playerInfo.points / playerInfo.gamesCount) + '</td><td>'
                    + playerInfo.gamesCount + '</td><td>'
                    + '</td></tr>';
            });
            table += "</table>";
            // TODO position / game
            let $leaderboard = $('<div>').append(table);
            $reportContainer.prepend($leaderboard);
            $('#leaderboard td').css('padding', '0 15px');
            $reports.each((index, obj) => {
                let fairReport = fairReports[index];
                $(obj).find('.clash-rank').text(fairReport.fairRank);
                if ($(obj).attr('class') === 'my-background') {
                    $(obj)
                        .find('div.clash-rank')
                        .css('background-color', 'blueviolet');
                }
                if (fairReport.score > 0) {
                    var bgColor;
                    switch (fairReport.fairRank) {
                        case 1:
                            bgColor = 'mediumseagreen';
                            break;
                        case 2:
                            bgColor = 'yellow';
                            break;
                        default: bgColor = 'orange';
                    }
                }
                else if (isNaN(fairReport.score)) {
                    bgColor = 'transparent';
                }
                else {
                    bgColor = 'indianred';
                }
                $(obj).css('background-color', bgColor);
                $(obj)
                    .find('button')
                    .css('background-color', '#e7e9eb');
            });
            // FIXME sortBy: fairRank -> score -> time 
            // $reportContainer
            //     .children('.header-result')
            //     .after(
            //         _($reports.detach())
            //             .sortBy($report => parseInt($($report).find('.clash-rank').text()))
            //             .value()
            //     );
        }
    }
}
//# sourceMappingURL=userscript.user.js.map