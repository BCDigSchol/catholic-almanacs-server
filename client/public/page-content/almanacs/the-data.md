---
title: What the Data Holds
description: How the almanacs' entries were simplified, structured and encoded
kind: Project page
---

# What the data holds

In an effort to be transparent about the places we had to simplify,
collapse and cull our data, we include here detailed descriptions of the
choices we made to create our dataset based on the information printed in
the highly inconsistent and often erroneous nineteenth-century almanacs.

## Institutions we encode

We encode nearly every US institution named in the almanacs. These include:

- **religious institutions** like churches, chapels, missions and stations;
- **educational institutions** like K–12 day and boarding schools, parochial
  schools, schools for boys and for girls, colleges, universities and other
  more specialized educational institutions;
- **healthcare institutions** like hospitals and infirmaries;
- **charitable institutions** like orphanages and asylums;
- **consecrated life institutions** like convents, monasteries and other
  religious communities.

In our first iteration of the 1870 almanac, we opted not to encode the
occasional layman's religious or charitable society when it had no location
information. We might revisit these societies in the future.

The fields we have for basic institution information are as follows:

- **instID:** a permanent identifier for the institution (for example
  `alb.ny.0001`), which stays the same however its name or details change
  from year to year.
- **type:** what the institution is identified as in the almanac, such as a
  "church" or "school." The almanac provides about forty of these terms, so,
  for counting purposes, these types all fall under one of five institution
  "functions": religious, educational, healthcare, charitable or consecrated
  life.
- **instName:** what the institution is called in the almanac, such as "St.
  Mary's" or "St. Aloysius's."
- **language:** if a language other than English is given for that
  institution, most often "German," it is recorded here. Sometimes the
  language seems to refer to a racial group rather than a language community,
  such as "Indian." The almanac's original language is retained.
- **instNote:** additional, loose information about an institution, such as
  notes about the building or its history.

## Encoding locations

We include the location of every institution in the almanacs in our dataset
so that we could geospatially visualize the array of institutions across the
United States. The location information takes a variety of forms. At their
best, the almanacs provide a street address, city name, county name and
state name. However, not all of those fields are always present. Sometimes
the location information is tied to a landmark instead of an address, and
sometimes it is less specific, referencing a valley, body of water or region.
We always record what the almanac provides, and we supplement additional or
refined information as convenient.

When the town changed names or is defunct (which we identify as part of our
coordinate process, explained below), our team does additional research to
find its current name or location so that we can assign it a coordinate. In
the future, we hope to create a process where those who are more
knowledgeable about specific regions can send us updated location information
to make our data as accurate as possible.

We record the information given in the almanac, the "original" information,
in columns marked with `_orig`. We record information we research, the
updated information, in columns marked with `_reg`.

The fields we have for locations are as follows:

- **placeName:** any address or place information provided by the almanac,
  ranging from "the corner of 4th and Front Streets" to "near the school
  house."
- **region:** any place information provided by the almanac that is not as
  specific as an address, county or city, usually a valley or other
  topographical feature in the West.
- **county_orig:** the original county listed in the almanac, if given
  (usually in more rural areas).
- **county_reg:** the county that institution is in today, which is
  occasionally different, if identified (sometimes only marked if counties in
  the dioceses changed).
- **city_orig:** the original city name listed in the almanac, if given.
- **city_reg:** the city that location is in today, which is sometimes
  different. If the original city is a misspelling, the correct spelling is
  shown here. If the town is defunct and no replacement has sprung up, the
  current city is left blank.
- **state_orig:** the original state listed in the almanac.
- **state_reg:** the state that location is in today, which is very rarely
  different (usually in Western territories-turned-states and West Virginia
  vs. Virginia).

### Adding coordinates

After we filled in all the above place information from the almanac and
outside research about changing city, county and state names, we derived the
best addresses possible from that information. Sometimes that includes
detailed information like cross-streets, and sometimes that is simply a town
name.

We then use a [geocoder developed by Awesome Table](https://workspace.google.com/marketplace/app/geocode_by_awesome_table/904124517349)
to create coordinates based on those addresses. When no coordinates can be
generated—usually because the town is defunct—our team does additional
research to find the coordinates of the historical institution. To that end,
the level of precision in locations identified varies by region. Sometimes we
can find a historical marker with exact coordinates of a location, and other
times we have to create a somewhat arbitrary point nearby a named creek, for
example, especially in rural areas. When we do research, we also include
links to the information sources we used to find the information.

## Encoding individuals

We record the individuals named in the almanac with the following
information:

- **persTitle:** the title given to the individual in the almanac, most often
  "Rev."
- **persName:** the exact spelling of the individual's full name, as written
  in the almanac, including abbreviations, punctuation, misspellings, etc.
- **persSuffix:** any suffix assigned to an individual, usually a religious
  order, such as S.J.
- **persRole:** the job title given to an individual, such as "superior" or
  "professor."
- **persNote:** any additional information given about an individual, usually
  that he is "absent" or "of" a certain town.

We then attempt to give every individual named in the almanac a unique ID so
that we can trace that individual's journey, perhaps through different
churches and dioceses, over time. However, our job is complicated by the fact
that names are slippery! Consider the following complications:

- many individuals appear more than once in the almanac, such as when an
  urban priest also visits or attends a nearby rural church that does not
  have its own dedicated priest;
- some different individuals share the same name, such as two James Smiths in
  different dioceses;
- some individuals have their name recorded differently in different years,
  usually with abbreviations or typos. For example, "James Smith" might be
  "J. Smith" another year because of an abbreviation and "Jams Smith" another
  year because of a typo.

Deducing which names represent distinct individuals and which names are
variants of the same individual is challenging, and something we work on
daily in our dataset. We created a script to automatically assign IDs based
on the individual's name and diocese, and our students spend a lot of time
correcting and reconciling those computer-generated IDs based on common sense
and historical research to make sure that individuals receive the correct ID.
Despite our best efforts, it is possible that we have associated (given the
same ID to) two individuals who are actually distinct persons. It is also
possible, and more likely, that we have falsely disambiguated two people,
meaning that one individual is listed with two different IDs. In the future,
we hope to create a process where those who are more knowledgeable about
specific individuals or dioceses can send us additional biographical
information to make our data as accurate as possible.

## Encoding groups of people

In addition to individuals, we record the groups of people named in the
almanac, usually religious orders. We identify these groups with the
following information:

- **member:** the unnamed people, as opposed to named individuals, that serve
  an institution, such as "twelve sisters" or "four teachers."
- **memberType:** the category of unnamed people, as opposed to named
  individuals, that serve an institution. So far, our types include "priest,"
  "religious," "student," "teacher," "child," "patient," and "layperson." Some
  one-off groups of people named in the almanac as serving an institution do
  not receive a type but are still recorded as members.
- **affiliated:** the description the almanac provides of other groups
  (usually religious orders) serving an institution, such as "Franciscan
  fathers" or "Dominican sisters."
- **order:** includes the names of select religious orders serving an
  institution. So far, only about 20 specific, known religious orders are
  identified in this field, though it continues to grow as we learn more and
  are able to disambiguate specific religious orders serving different US
  cities. Thanks to the "order" field, our institutions can be filtered by the
  religious orders that serve them, especially when we have additional
  histories about that order.

## Data model

Each diocese in each year is one spreadsheet, e.g., Alton 1870 and
Cincinnati 1837. So far, to cover 1834–38 and 1860–70, that leaves us with
about 450 separate spreadsheets. All spreadsheets have the same columns on
the same four tabs. Only the first tab (the master) is ingested into the
database. (The following three tabs hold slices of data that are generated
for the master, the second tab for locations and the third and fourth for
people IDs.)

In this site, each spreadsheet row becomes an *almanac record*: an
institution as it appeared in one year, with the people listed there. The
[Coverage dashboard](/dashboards/coverage) shows which dioceses and years are
in the database so far.

## Data creation history

### The original data creation process

In the spring and summer of 2024, a team of outstanding BC humanities
students under the direction of Ashlyn Stewart and funded by the Libraries'
Catholic Collections Initiative undertook the crucial and unglamorous
transcribing and encoding work required to launch the project. The students
tagged (and, thus, structured) each institution's name, place and affiliates
for the 1870 almanac in XML format. We then transformed the XML data into a
.csv format to power our visualizations more easily.

### Continuing data creation

Students are now working from both ends of the almanac run, extracting each
institution's name, place and affiliates for almanacs in two periods: 1834–43
and 1860–69. To fill in prior years, students compare the 1869 almanac
against our 1870 data, identifying places that have changed to create the
1869 dataset without having to encode from whole cloth. If there is no change
year over year, the students are able to pretty quickly fill in a diocese's
information based on the following year. However, if there are changes (which
often happens with an individual's name or place name), encoding the data
takes a bit longer. The process will continue year by year until the two
teams meet in the 1850s. Then, the team will return to 1871 and move forward
in the same fashion through 1895.

Our team adds new data about different dioceses in different years every day
and publishes updated data quarterly. If you don't see a diocese in a
particular year that you're curious about, [drop us a line](/pages/almanacs/contact);
we can give you an estimate of when it will be ready.
