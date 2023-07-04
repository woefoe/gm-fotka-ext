"""Analyze fotka presence logs collected using gm-fotka-customizer.
   This module will help You to work with the collected presence logs data and create files that may help with analysis

   Usage: python -m analyzer.py -o encounters.txt -o suspects.txt *.Glowny.users.txt
"""

from collections import namedtuple
from collections.abc import Generator, Iterable
from operator import itemgetter
from math import ceil
import datetime

PresenceRecord = tuple[datetime.datetime, list[str]]

# TODO
# Present data in extended format showing exact days
# tomas(mod) 1160
#   2023-05-06 2023-06-07 2023-07-15
#
#     Motylove(mod) 335/1160
#       2023-05-06 2023-07-15
#     Miloslaw      25/1160
#       2023-06-07
#
# More analysis formats, showing day times of presence, week days of presence


def presences_from_files(files: Iterable[str], progbar=True) -> Generator[PresenceRecord]:
    if progbar:
        from tqdm import tqdm
        files = tqdm(files)
    for file in files:
        with open(file) as fd:
            for presence in presences_from_stream(fd):
                yield presence


def presences_from_stream(stream) -> Generator[PresenceRecord]:
    for line in stream:
        try:
            datestr, _, usernamesstr = line.split("\t")
        except ValueError:
            #print(f"Warning!, malformed line:\n{line}", file=sys.stderr)
            continue
        date = datetime.datetime.fromisoformat(datestr)
        usernames = usernamesstr.strip().replace('*', '').split(" ")
        yield PresenceRecord(date, usernames)


PresenceRecord = namedtuple("PresenceRecord", ["date", "usernames"])


class Appearance:
    def __init__(self, count=0, dates={}):
        self.count: int = 0
        self.dates: map[datetime.date, set[datetime.time]] = dates


class Appearances:
    def __init__(self, presences: Iterable[PresenceRecord], min_appearances=100):
        # appearances of users and bystanders
        # user1:    {
        #                user1: {
        #                        date(2023, 05, 23): Appearance,
        #                        date(2023, 05, 24): Appearance,
        #                        }
        #            }
        self.encounters: map[str, map[str, Appearance]] = {}
        self.total = 0
        self.dates: set[datetime.date] = set()

        for self.total, (timestamp, users) in enumerate(presences):
            for user in users:
                if user not in self.encounters:
                    self.encounters[user] = {}
                user_encounters = self.encounters[user]
                for bystander in users:
                    if bystander not in user_encounters:
                        user_encounters[bystander] = Appearance(0, dict())
                    user_encounters[bystander].count += 1
                    date = timestamp.date()
                    if date not in user_encounters[bystander].dates:
                        user_encounters[bystander].dates[date] = set()
                        if date not in self.dates:
                            self.dates.add(date)
                    user_encounters[bystander].dates[date].add(timestamp.time().replace(minute=0, second=0, microsecond=0))

        if min_appearances:
            for user in list(self.encounters.keys()):
                if self.encounters[user][user].count < min_appearances:
                    del self.encounters[user]
                    for _, user_encounters in self.encounters.items():
                        if user in user_encounters:
                            del user_encounters[user]
                    continue

    def dump_encounters(self, file, show_dates=True):
        """Dump encounter data into a format that helps to review each user encounters.
           Search for lines starting with username, to jump to the section.

           Format Example:

           tomas(mod) 1160                      # username and overall logs with the user
             2023-05-06 2023-06-07 2023-07-15   # dates the user was seen in the chat

             Mon  | Tue  | Wed  | Thu  | Fri  | Sat  | Sun
              25%    25%    25%    25%     0%     0%     0%

             1         12          24
              ▃▃     █▆▃ ▃▆▃  ▃▃▃    

               Motylove(mod) 335/1160           # number of encounters (logs with both of the users)
                 2023-05-06 2023-07-15          # TODO dates of the encounters
               Miloslaw      25/1160
                 2023-06-07
        """
        for user, user_encounters in self.encounters.items():
            records = user_encounters[user].count
            dates = user_encounters[user].dates
            print(f"{user:<18}: {records}", file=file)
            print(file=file)

            if show_dates:
                print(f"  Days total: {len(dates.keys())}", file=file)
                for i, date in enumerate(sorted(dates.keys())):
                    if i != 0 and i % 10 == 0:
                        print("", file=file)
                    print(f"  {date.isoformat()}", end='', file=file)
                print("\n", file=file)

            hours: list[int] = [0] * 24
            weekdays: list[int] = [0] * 7
            for date, datehours in user_encounters[user].dates.items():
                weekdays[date.weekday()] += 1
                for datehour in datehours:
                    hours[datehour.hour] += 1

            print("  Mon  | Tue  | Wed  | Thu  | Fri  | Sat  | Sun", file=file)
            values = []
            dates_total = len(user_encounters[user].dates)
            for count in weekdays:
                values.append("{:>4.0%}".format(count / dates_total if dates_total > 0 else 0))
            print("  " + "   ".join(values), file=file)
            print(file=file)

            bars = " ▁▂▃▄▅▆▇█"
            max_hours = max(hours)
            bars_per_hour = []
            for count in hours:
                bar_index = ceil(count / max_hours * 8)
                bars_per_hour.append(bars[bar_index])
            print("  1         12          24", file=file)
            print("  " + "".join(bars_per_hour), file=file)
            print(file=file)

            for shared_records, bystander in sorted([(appearance.count, bystander) for bystander, appearance in user_encounters.items()], reverse=True):
                if user == bystander:
                    continue
                shared_percent = shared_records / records
                print(f"    {bystander:<18}: {shared_percent: >7.2%} ({shared_records}/{records})", file=file)

    def dump_suspects(self, file):
        """Dump encounter data in a tab-separated CSV.
           Suspects format is meant to help identify most likely relations between users.

           This format tries to sort users in relations most likely to be meaningful (see the score['importance'] value).
           Users that tend not to be together at the same time, that are online at the same days and hours are more likely to be in ownership of the same person.

           Days/hours/logs fields are in order: shared presences, first user presences, second user presences, total logs (in last column)

           Format Example:

           # more meaningful | less meaningful  | days   | hours     | perc   |         logs
           Elisza             NIEBooNIEE         32/42/32 145/322/201   7.26%  1217/16764/ 1890/25290
           cichutka1          Frania2805         39/40/42 153/251/247  15.04%  1910/12702/ 4013/25290
           Spejson2           Frania2805         38/38/42 133/239/247  12.13%   739/ 6093/ 4013/25290
           Jarek0475          WitekWojciechiwski 37/41/39 110/258/192  10.88%  1258/11567/ 3324/25290
        """
        ScoreRecord = namedtuple("ScoreRecord", [
            "user",
            "suspect",
            "shared_dates",
            "suspect_dates",
            "user_dates",
            "presence_ratio",
            "shared_records",
            "suspect_records",
            "user_records"
        ])
        similarity_scores: list[ScoreRecord] = []
        for user, user_encounters in self.encounters.items():
            user_dates = user_encounters[user].dates
            user_records = user_encounters[user].count
            for suspect, suspect_encounters in self.encounters.items():
                if user == suspect:
                    continue

                suspect_dates = suspect_encounters[suspect].dates
                suspect_records = suspect_encounters[suspect].count

                try:
                    shared_records = user_encounters[suspect].count
                except KeyError:
                    shared_records = 0

                # we want the user with higher score to be in front ;p
                if (user_records < suspect_records):
                    continue

                shared_dates = {date: hours & suspect_dates[date]
                                for (date, hours) in user_dates.items()
                                if date in suspect_dates}

                score = {
                        "user": user,
                        "suspect": suspect,
                        "shared_records": shared_records,
                        "user_records": user_records,
                        "suspect_records": suspect_records,
                        "shared_dates": len(shared_dates),
                        "user_dates": len(user_dates),
                        "suspect_dates": len(suspect_dates),
                        "shared_hours": sum(len(hours) for hours in shared_dates.values()),
                        "user_hours": sum(len(hours) for hours in user_dates.values()),
                        "suspect_hours": sum(len(hours) for hours in suspect_dates.values()),
                        "presence_ratio": shared_records / user_records
                }

                score["importance"] = (
                        # dates and hours shared should be the most meaningful
                        score["shared_dates"] * score["shared_hours"] *
                        # decrease importance of users with low presence in exponential manner
                        (0.1 ** 10 ** score["presence_ratio"]) *
                        # decrease importance of users who appear during others users presence (Elisza killer)
                        ((score["suspect_records"] - score["shared_records"]) / score["suspect_records"]) *
                        # weigh the importance of the relation basing on their presence in chat
                        ((score["user_records"] + score["suspect_records"]) / self.total))

                # TODO add hours and days of week

                similarity_scores.append(score)

        record_format = ' '.join((
            "{user:<18}",
            "{suspect:<18}",
            "{shared_dates: >2}/{user_dates: >2}/{suspect_dates: >2}",
            "{shared_hours: >3}/{user_hours: >3}/{suspect_hours: >3}",
            "{presence_ratio: >7.2%}",
            "{shared_records: >5}/{user_records: >5}/{suspect_records: >5}/{total: >5}"
        ))

        for score in sorted(similarity_scores, key=itemgetter('importance'), reverse=True):
            print(record_format.format(total=self.total, **score), file=file)


if __name__ == "__main__":
    from argparse import ArgumentParser, FileType

    parser = ArgumentParser()
    parser.add_argument("-o", "--output-encounters", type=FileType('w'), default=None)
    parser.add_argument("-s", "--output-suspects", type=FileType('w'), default=None)
    parser.add_argument("-p", "--progress", action="store_false")
    parser.add_argument("input_files", nargs='+')
    parser.add_argument("--strip-under", type=int, default=0)
    args = parser.parse_args()

    if args.input_files[0] == "--":
        # TODO if input_files is --, use stdin
        raise ArgumentError("standard input is not supported")

    print("Reading files")
    appearances = Appearances(presences_from_files(args.input_files, args.progress), args.strip_under)
    if args.output_encounters:
        print("Analyzing encounter behavior...")
        appearances.dump_encounters(args.output_encounters)
    if args.output_suspects:
        print("Investigating suspects...")
        appearances.dump_suspects(args.output_suspects)
