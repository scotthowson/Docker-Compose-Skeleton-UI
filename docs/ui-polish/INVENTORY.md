# UI inventory

Generated from the source of this branch (the counts are occurrences in the file; *where* lists the first few
lines). **Mantine** names the Mantine components the file draws that element with; a blank means the element is
the dashboard's own Tailwind markup. Pages first, then the shared components they are built from. The
consistency findings and the decisions this inventory fed are in [AUDIT.md](AUDIT.md).

## Pages

| page / component | element | count | where (file:line) | Mantine | notes |
|---|---|---:|---|---|---|
| **Activity** | button | 6 | Activity.tsx:233, Activity.tsx:390, Activity.tsx:608, Activity.tsx:662 |  | Mantine SegmentedControl (event type); was a tab row that ran off a phone |
|  | text input | 2 | Activity.tsx:648, Activity.tsx:765 |  |  |
|  | select | 1 | Activity.tsx:749 |  |  |
|  | chip / pill / badge | 1 | Activity.tsx:845 | Badge (VmCapsule) |  |
|  | segmented / tabs | 1 | Activity.tsx:637 | SegmentedControl |  |
|  | loading state | 2 | Activity.tsx:215, Activity.tsx:791 |  |  |
|  | empty state | 2 | Activity.tsx:421, Activity.tsx:801 |  |  |
| **Automations** | button | 22 | Automations.tsx:431, Automations.tsx:439, Automations.tsx:446, Automations.tsx:504 |  |  |
|  | card / panel | 5 | Automations.tsx:460, Automations.tsx:469, Automations.tsx:478, Automations.tsx:487 |  |  |
|  | text input | 3 | Automations.tsx:887, Automations.tsx:933, Automations.tsx:1004 |  |  |
|  | select | 2 | Automations.tsx:967, Automations.tsx:986 |  |  |
|  | chip / pill / badge | 3 | Automations.tsx:588, Automations.tsx:611, Automations.tsx:616 | Badge (VmCapsule) |  |
|  | sheet / dialog / overlay | 4 | Automations.tsx:734, Automations.tsx:735, Automations.tsx:863, Automations.tsx:864 |  |  |
|  | loading state | 6 | Automations.tsx:546, Automations.tsx:598, Automations.tsx:675, Automations.tsx:703 |  |  |
|  | empty state | 1 | Automations.tsx:765 |  |  |
|  | error state | 1 | Automations.tsx:550 |  |  |
| **Backup** | button | 13 | Backup.tsx:447, Backup.tsx:454, Backup.tsx:479, Backup.tsx:492 |  |  |
|  | card / panel | 9 | Backup.tsx:473, Backup.tsx:520, Backup.tsx:720, Backup.tsx:744 |  |  |
|  | text input | 1 | Backup.tsx:1077 |  |  |
|  | select | 2 | Backup.tsx:528, Backup.tsx:820 |  |  |
|  | chip / pill / badge | 6 | Backup.tsx:524, Backup.tsx:702, Backup.tsx:724, Backup.tsx:874 | Badge (VmCapsule) |  |
|  | table | 1 | Backup.tsx:901 |  |  |
|  | sheet / dialog / overlay | 2 | Backup.tsx:1006, Backup.tsx:1007 |  |  |
|  | loading state | 11 | Backup.tsx:427, Backup.tsx:582, Backup.tsx:587, Backup.tsx:614 |  |  |
|  | empty state | 2 | Backup.tsx:571, Backup.tsx:924 |  |  |
| **Bookmarks** | button | 10 | Bookmarks.tsx:138, Bookmarks.tsx:160, Bookmarks.tsx:235, Bookmarks.tsx:243 |  |  |
|  | card / panel | 3 | Bookmarks.tsx:126, Bookmarks.tsx:271, Bookmarks.tsx:452 |  |  |
|  | text input | 4 | Bookmarks.tsx:184, Bookmarks.tsx:210, Bookmarks.tsx:224, Bookmarks.tsx:478 |  |  |
|  | select | 1 | Bookmarks.tsx:200 |  |  |
|  | chip / pill / badge | 1 | Bookmarks.tsx:293 |  |  |
| **Config** | button | 2 | Config.tsx:497, Config.tsx:511 |  | Mantine Switch in every ToggleRow; every row's switch, select or input named after its row |
|  | card / panel | 3 | Config.tsx:232, Config.tsx:558, Config.tsx:565 |  |  |
|  | text input | 2 | Config.tsx:146, Config.tsx:185 |  |  |
|  | select | 1 | Config.tsx:102 |  |  |
|  | checkbox / switch | 1 | Config.tsx:46 | Switch |  |
|  | loading state | 1 | Config.tsx:819 |  |  |
| **Containers** | button | 1 | Containers.tsx:195 |  | the list is ContainerList/ContainerRow (favorite star named, select-all named) |
|  | loading state | 1 | Containers.tsx:189 |  |  |
| **CronJobs** | button | 17 | CronJobs.tsx:327, CronJobs.tsx:334, CronJobs.tsx:343, CronJobs.tsx:350 |  | headed "Cron Jobs" (it said "Scheduled Tasks", the Schedules page's name); the expand buttons named, with aria-expanded; the expand column has a hidden header |
|  | card / panel | 2 | CronJobs.tsx:363, CronJobs.tsx:672 |  |  |
|  | text input | 3 | CronJobs.tsx:434, CronJobs.tsx:456, CronJobs.tsx:468 |  |  |
|  | textarea | 1 | CronJobs.tsx:669 |  |  |
|  | table | 1 | CronJobs.tsx:547 |  |  |
|  | sheet / dialog / overlay | 2 | CronJobs.tsx:642, CronJobs.tsx:643 |  |  |
|  | loading state | 3 | CronJobs.tsx:505, CronJobs.tsx:519, CronJobs.tsx:695 |  |  |
|  | empty state | 1 | CronJobs.tsx:523 |  |  |
| **DNS** | button | 26 | DNS.tsx:152, DNS.tsx:153, DNS.tsx:229, DNS.tsx:275 |  |  |
|  | card / panel | 7 | DNS.tsx:651, DNS.tsx:668, DNS.tsx:687, DNS.tsx:744 |  |  |
|  | text input | 7 | DNS.tsx:243, DNS.tsx:256, DNS.tsx:270, DNS.tsx:292 |  |  |
|  | select | 3 | DNS.tsx:236, DNS.tsx:263, DNS.tsx:964 |  |  |
|  | textarea | 1 | DNS.tsx:254 |  |  |
|  | chip / pill / badge | 5 | DNS.tsx:750, DNS.tsx:848, DNS.tsx:897, DNS.tsx:971 | Badge (VmCapsule) |  |
|  | table | 1 | DNS.tsx:1008 |  |  |
|  | sheet / dialog / overlay | 6 | DNS.tsx:129, DNS.tsx:130, DNS.tsx:216, DNS.tsx:217 |  |  |
|  | loading state | 11 | DNS.tsx:154, DNS.tsx:308, DNS.tsx:362, DNS.tsx:600 |  |  |
|  | empty state | 5 | DNS.tsx:858, DNS.tsx:860, DNS.tsx:952, DNS.tsx:1003 |  |  |
|  | error state | 5 | DNS.tsx:298, DNS.tsx:803, DNS.tsx:856, DNS.tsx:999 |  |  |
| **Dashboard** | button | 3 | Dashboard.tsx:137, Dashboard.tsx:449, Dashboard.tsx:534 |  | page title h1 text-lg md:text-2xl |
|  | loading state | 2 | Dashboard.tsx:93, Dashboard.tsx:97 |  |  |
| **Diagnostics** | button | 9 | Diagnostics.tsx:414, Diagnostics.tsx:799, Diagnostics.tsx:831, Diagnostics.tsx:1072 |  | Mantine Switch (rose) for "Also wipe the stacks"; Title Case reset buttons |
|  | card / panel | 12 | Diagnostics.tsx:165, Diagnostics.tsx:534, Diagnostics.tsx:1534, Diagnostics.tsx:1577 |  |  |
|  | text input | 2 | Diagnostics.tsx:1168, Diagnostics.tsx:1188 |  |  |
|  | checkbox / switch | 1 | Diagnostics.tsx:1212 | Switch |  |
|  | table | 1 | Diagnostics.tsx:401 |  |  |
|  | tooltip | 1 | Diagnostics.tsx:497 |  |  |
|  | progress / meter | 1 | Diagnostics.tsx:510 |  |  |
|  | loading state | 3 | Diagnostics.tsx:817, Diagnostics.tsx:851, Diagnostics.tsx:1248 |  |  |
|  | empty state | 2 | Diagnostics.tsx:311, Diagnostics.tsx:526 |  |  |
| **DiskAnalysis** | button | 7 | DiskAnalysis.tsx:146, DiskAnalysis.tsx:152, DiskAnalysis.tsx:433, DiskAnalysis.tsx:449 |  |  |
|  | card / panel | 10 | DiskAnalysis.tsx:369, DiskAnalysis.tsx:465, DiskAnalysis.tsx:480, DiskAnalysis.tsx:495 |  |  |
|  | text input | 1 | DiskAnalysis.tsx:623 |  |  |
|  | chip / pill / badge | 2 | DiskAnalysis.tsx:546, DiskAnalysis.tsx:592 |  |  |
|  | table | 1 | DiskAnalysis.tsx:771 |  |  |
|  | sheet / dialog / overlay | 2 | DiskAnalysis.tsx:111, DiskAnalysis.tsx:113 |  |  |
|  | tooltip | 1 | DiskAnalysis.tsx:741 |  |  |
|  | progress / meter | 1 | DiskAnalysis.tsx:750 |  |  |
|  | loading state | 7 | DiskAnalysis.tsx:319, DiskAnalysis.tsx:321, DiskAnalysis.tsx:323, DiskAnalysis.tsx:324 |  |  |
|  | error state | 1 | DiskAnalysis.tsx:348 |  |  |
| **Environment** | button | 10 | Environment.tsx:129, Environment.tsx:456, Environment.tsx:491, Environment.tsx:521 |  |  |
|  | card / panel | 4 | Environment.tsx:600, Environment.tsx:730, Environment.tsx:743, Environment.tsx:754 |  |  |
|  | select | 1 | Environment.tsx:640 |  |  |
|  | textarea | 1 | Environment.tsx:182 |  |  |
|  | table | 1 | Environment.tsx:83 |  |  |
|  | loading state | 4 | Environment.tsx:596, Environment.tsx:622, Environment.tsx:739, Environment.tsx:774 |  |  |
|  | empty state | 1 | Environment.tsx:78 |  |  |
| **EventFeed** | button | 4 | EventFeed.tsx:212, EventFeed.tsx:228, EventFeed.tsx:236, EventFeed.tsx:254 |  |  |
|  | card / panel | 3 | EventFeed.tsx:207, EventFeed.tsx:269, EventFeed.tsx:286 |  |  |
|  | chip / pill / badge | 1 | EventFeed.tsx:299 | Badge (VmCapsule) |  |
|  | loading state | 1 | EventFeed.tsx:194 |  |  |
|  | empty state | 1 | EventFeed.tsx:274 |  |  |
| **Export** | button | 8 | Export.tsx:329, Export.tsx:470, Export.tsx:506, Export.tsx:548 |  | card select buttons named and aria-pressed |
|  | card / panel | 4 | Export.tsx:483, Export.tsx:493, Export.tsx:540, Export.tsx:616 |  |  |
|  | loading state | 3 | Export.tsx:335, Export.tsx:512, Export.tsx:560 |  |  |
| **FileBrowser** | button | 7 | FileBrowser.tsx:124, FileBrowser.tsx:133, FileBrowser.tsx:406, FileBrowser.tsx:469 |  |  |
|  | select | 1 | FileBrowser.tsx:437 |  |  |
|  | sheet / dialog / overlay | 2 | FileBrowser.tsx:111, FileBrowser.tsx:112 |  |  |
|  | loading state | 2 | FileBrowser.tsx:519, FileBrowser.tsx:632 |  |  |
|  | error state | 1 | FileBrowser.tsx:524 |  |  |
| **Health** | button | 6 | Health.tsx:487, Health.tsx:501, Health.tsx:532, Health.tsx:573 |  | page title is an h2 (text-xl); LoadingState in the table |
|  | card / panel | 6 | Health.tsx:222, Health.tsx:520, Health.tsx:607, Health.tsx:620 |  |  |
|  | text input | 1 | Health.tsx:797 |  |  |
|  | chip / pill / badge | 3 | Health.tsx:668, Health.tsx:860, Health.tsx:910 | Badge (VmCapsule) |  |
|  | table | 1 | Health.tsx:810 |  |  |
|  | loading state | 7 | Health.tsx:135, Health.tsx:285, Health.tsx:560, Health.tsx:561 |  |  |
| **Images** | button | 14 | Images.tsx:291, Images.tsx:306, Images.tsx:317, Images.tsx:332 |  | batch mode (ImageList): the select column has a hidden header, each row checkbox is a named role="checkbox" |
|  | card / panel | 1 | Images.tsx:391 |  |  |
|  | text input | 2 | Images.tsx:421, Images.tsx:540 |  |  |
|  | chip / pill / badge | 2 | Images.tsx:608, Images.tsx:614 |  |  |
|  | loading state | 6 | Images.tsx:301, Images.tsx:346, Images.tsx:460, Images.tsx:562 |  |  |
|  | empty state | 2 | Images.tsx:517, Images.tsx:576 |  |  |
| **Login** | button | 16 | Login.tsx:643, Login.tsx:701, Login.tsx:761, Login.tsx:813 |  | "Remember me" is a role="checkbox" with its label |
|  | card / panel | 1 | Login.tsx:571 |  |  |
|  | text input | 11 | Login.tsx:607, Login.tsx:724, Login.tsx:747, Login.tsx:781 |  |  |
|  | loading state | 7 | Login.tsx:526, Login.tsx:623, Login.tsx:657, Login.tsx:828 |  |  |
| **Logs** | button | 13 | Logs.tsx:308, Logs.tsx:323, Logs.tsx:337, Logs.tsx:352 |  |  |
|  | card / panel | 4 | Logs.tsx:371, Logs.tsx:468, Logs.tsx:658, Logs.tsx:709 |  |  |
|  | text input | 1 | Logs.tsx:529 |  |  |
|  | select | 1 | Logs.tsx:546 |  |  |
|  | chip / pill / badge | 1 | Logs.tsx:579 |  |  |
|  | table | 1 | Logs.tsx:748 |  |  |
|  | empty state | 1 | Logs.tsx:744 |  |  |
|  | error state | 2 | Logs.tsx:387, Logs.tsx:733 |  |  |
| **Maintenance** | button | 10 | Maintenance.tsx:351, Maintenance.tsx:357, Maintenance.tsx:390, Maintenance.tsx:405 |  |  |
|  | card / panel | 6 | Maintenance.tsx:312, Maintenance.tsx:424, Maintenance.tsx:471, Maintenance.tsx:546 |  |  |
|  | chip / pill / badge | 12 | Maintenance.tsx:563, Maintenance.tsx:567, Maintenance.tsx:583, Maintenance.tsx:588 | Badge (VmCapsule) |  |
|  | table | 4 | Maintenance.tsx:680, Maintenance.tsx:714, Maintenance.tsx:744, Maintenance.tsx:830 |  |  |
|  | sheet / dialog / overlay | 2 | Maintenance.tsx:306, Maintenance.tsx:308 |  |  |
|  | loading state | 7 | Maintenance.tsx:487, Maintenance.tsx:504, Maintenance.tsx:521, Maintenance.tsx:538 |  |  |
| **Networks** | button | 19 | Networks.tsx:59, Networks.tsx:170, Networks.tsx:207, Networks.tsx:235 |  | the header wraps its actions on a phone (they ran 95 px off it) |
|  | card / panel | 8 | Networks.tsx:399, Networks.tsx:477, Networks.tsx:492, Networks.tsx:516 |  |  |
|  | text input | 7 | Networks.tsx:191, Networks.tsx:225, Networks.tsx:229, Networks.tsx:244 |  |  |
|  | select | 1 | Networks.tsx:553 |  |  |
|  | chip / pill / badge | 4 | Networks.tsx:707, Networks.tsx:733, Networks.tsx:736, Networks.tsx:740 | Badge (VmCapsule) |  |
|  | sheet / dialog / overlay | 6 | Networks.tsx:157, Networks.tsx:158, Networks.tsx:405, Networks.tsx:406 |  |  |
|  | loading state | 6 | Networks.tsx:296, Networks.tsx:442, Networks.tsx:536, Networks.tsx:567 |  |  |
|  | error state | 5 | Networks.tsx:281, Networks.tsx:447, Networks.tsx:578, Networks.tsx:645 |  |  |
| **Notifications** | button | 30 | Notifications.tsx:574, Notifications.tsx:581, Notifications.tsx:591, Notifications.tsx:610 |  |  |
|  | card / panel | 5 | Notifications.tsx:726, Notifications.tsx:774, Notifications.tsx:822, Notifications.tsx:965 |  |  |
|  | text input | 6 | Notifications.tsx:1069, Notifications.tsx:1262, Notifications.tsx:1293, Notifications.tsx:1328 |  |  |
|  | select | 1 | Notifications.tsx:1274 |  |  |
|  | textarea | 1 | Notifications.tsx:1379 |  |  |
|  | chip / pill / badge | 1 | Notifications.tsx:705 |  |  |
|  | sheet / dialog / overlay | 2 | Notifications.tsx:1238, Notifications.tsx:1239 |  |  |
|  | loading state | 9 | Notifications.tsx:587, Notifications.tsx:818, Notifications.tsx:881, Notifications.tsx:897 |  |  |
|  | empty state | 2 | Notifications.tsx:826, Notifications.tsx:969 |  |  |
| **Plugins** | button | 19 | Plugins.tsx:139, Plugins.tsx:382, Plugins.tsx:390, Plugins.tsx:397 |  |  |
|  | text input | 1 | Plugins.tsx:772 |  |  |
|  | chip / pill / badge | 1 | Plugins.tsx:508 |  |  |
|  | sheet / dialog / overlay | 4 | Plugins.tsx:755, Plugins.tsx:756, Plugins.tsx:812, Plugins.tsx:813 |  |  |
|  | loading state | 3 | Plugins.tsx:601, Plugins.tsx:626, Plugins.tsx:800 |  |  |
|  | empty state | 1 | Plugins.tsx:631 |  |  |
| **Proxmox** | button | 51 | Proxmox.tsx:144, Proxmox.tsx:167, Proxmox.tsx:168, Proxmox.tsx:200 |  | Mantine Badge (VM/LXC, hub/member, role, DCS, Proxmox tags), SegmentedControl (Show, View), Tooltip; guest skeletons; empty state with "Clear the filters"; 52 `title` hints on icon buttons |
|  | card / panel | 3 | Proxmox.tsx:191, Proxmox.tsx:1140, Proxmox.tsx:1159 |  |  |
|  | text input | 1 | Proxmox.tsx:1196 |  |  |
|  | chip / pill / badge | 15 | Proxmox.tsx:109, Proxmox.tsx:117, Proxmox.tsx:118, Proxmox.tsx:285 | Badge, Badge (VmCapsule) |  |
|  | segmented / tabs | 2 | Proxmox.tsx:1200, Proxmox.tsx:1211 | SegmentedControl |  |
|  | table | 1 | Proxmox.tsx:772 |  |  |
|  | sheet / dialog / overlay | 6 | Proxmox.tsx:189, Proxmox.tsx:190, Proxmox.tsx:838, Proxmox.tsx:930 |  |  |
|  | tooltip | 5 | Proxmox.tsx:118, Proxmox.tsx:308, Proxmox.tsx:570, Proxmox.tsx:1217 | Tooltip |  |
|  | progress / meter | 4 | Proxmox.tsx:138, Proxmox.tsx:603, Proxmox.tsx:718, Proxmox.tsx:855 |  |  |
|  | loading state | 20 | Proxmox.tsx:205, Proxmox.tsx:220, Proxmox.tsx:314, Proxmox.tsx:364 |  |  |
|  | empty state | 3 | Proxmox.tsx:350, Proxmox.tsx:501, Proxmox.tsx:619 |  |  |
|  | error state | 3 | Proxmox.tsx:198, Proxmox.tsx:870, Proxmox.tsx:1224 |  |  |
| **Schedules** | button | 15 | Schedules.tsx:127, Schedules.tsx:132, Schedules.tsx:186, Schedules.tsx:197 |  | the expand buttons named, with aria-expanded |
|  | card / panel | 7 | Schedules.tsx:139, Schedules.tsx:142, Schedules.tsx:144, Schedules.tsx:158 |  |  |
|  | text input | 4 | Schedules.tsx:275, Schedules.tsx:296, Schedules.tsx:325, Schedules.tsx:343 |  |  |
|  | select | 4 | Schedules.tsx:279, Schedules.tsx:285, Schedules.tsx:329, Schedules.tsx:335 |  |  |
|  | chip / pill / badge | 1 | Schedules.tsx:169 | Badge (VmCapsule) |  |
|  | sheet / dialog / overlay | 6 | Schedules.tsx:262, Schedules.tsx:263, Schedules.tsx:312, Schedules.tsx:313 |  |  |
|  | loading state | 4 | Schedules.tsx:142, Schedules.tsx:192, Schedules.tsx:302, Schedules.tsx:349 |  |  |
|  | empty state | 1 | Schedules.tsx:239 |  |  |
|  | error state | 1 | Schedules.tsx:139 |  |  |
| **Secrets** | button | 16 | Secrets.tsx:220, Secrets.tsx:224, Secrets.tsx:229, Secrets.tsx:244 |  |  |
|  | card / panel | 9 | Secrets.tsx:277, Secrets.tsx:285, Secrets.tsx:290, Secrets.tsx:293 |  |  |
|  | text input | 2 | Secrets.tsx:277, Secrets.tsx:370 |  |  |
|  | textarea | 1 | Secrets.tsx:391 |  |  |
|  | chip / pill / badge | 2 | Secrets.tsx:312, Secrets.tsx:434 | Badge (VmCapsule) |  |
|  | sheet / dialog / overlay | 4 | Secrets.tsx:360, Secrets.tsx:361, Secrets.tsx:424, Secrets.tsx:425 |  |  |
|  | loading state | 4 | Secrets.tsx:290, Secrets.tsx:334, Secrets.tsx:414, Secrets.tsx:438 |  |  |
| **Settings** | button | 51 | Settings.tsx:233, Settings.tsx:259, Settings.tsx:424, Settings.tsx:614 |  | Mantine Switch (remember username, toasts, alert preferences); 40+ Title Case labels; collapsible sections |
|  | text input | 29 | Settings.tsx:243, Settings.tsx:271, Settings.tsx:292, Settings.tsx:312 |  |  |
|  | select | 2 | Settings.tsx:353, Settings.tsx:390 |  |  |
|  | textarea | 2 | Settings.tsx:332, Settings.tsx:2920 |  |  |
|  | checkbox / switch | 3 | Settings.tsx:1673, Settings.tsx:1702, Settings.tsx:2142 | Switch |  |
|  | chip / pill / badge | 2 | Settings.tsx:1966, Settings.tsx:1967 |  |  |
|  | tooltip | 1 | Settings.tsx:1411 |  |  |
|  | loading state | 6 | Settings.tsx:1251, Settings.tsx:1287, Settings.tsx:1308, Settings.tsx:1979 |  |  |
|  | error state | 2 | Settings.tsx:1291, Settings.tsx:1315 |  |  |
| **SetupWizard** | button | 31 | SetupWizard.tsx:971, SetupWizard.tsx:1065, SetupWizard.tsx:1177, SetupWizard.tsx:1211 |  | Mantine Switch ×9, the VM step's VmSettingsFields (Mantine Select), PlanCapacity (Mantine Progress/Tooltip); hand-made step indicator kept (see AUDIT) |
|  | text input | 39 | SetupWizard.tsx:1056, SetupWizard.tsx:1191, SetupWizard.tsx:1199, SetupWizard.tsx:1232 |  |  |
|  | select | 6 | SetupWizard.tsx:1612, SetupWizard.tsx:1699, SetupWizard.tsx:1855, SetupWizard.tsx:2128 |  |  |
|  | checkbox / switch | 8 | SetupWizard.tsx:157, SetupWizard.tsx:1495, SetupWizard.tsx:1833, SetupWizard.tsx:1903 | Switch |  |
|  | chip / pill / badge | 1 | SetupWizard.tsx:2287 |  |  |
|  | sheet / dialog / overlay | 2 | SetupWizard.tsx:993, SetupWizard.tsx:1001 |  |  |
|  | tooltip | 1 | SetupWizard.tsx:1900 | Tooltip |  |
|  | loading state | 7 | SetupWizard.tsx:969, SetupWizard.tsx:977, SetupWizard.tsx:1072, SetupWizard.tsx:1217 |  |  |
|  | error state | 1 | SetupWizard.tsx:1030 |  |  |
| **Snapshots** | button | 14 | Snapshots.tsx:184, Snapshots.tsx:200, Snapshots.tsx:216, Snapshots.tsx:276 |  |  |
|  | card / panel | 4 | Snapshots.tsx:132, Snapshots.tsx:696, Snapshots.tsx:739, Snapshots.tsx:826 |  |  |
|  | text input | 2 | Snapshots.tsx:258, Snapshots.tsx:765 |  |  |
|  | chip / pill / badge | 3 | Snapshots.tsx:141, Snapshots.tsx:152, Snapshots.tsx:158 | Badge (VmCapsule) |  |
|  | loading state | 5 | Snapshots.tsx:197, Snapshots.tsx:289, Snapshots.tsx:331, Snapshots.tsx:788 |  |  |
|  | empty state | 1 | Snapshots.tsx:830 |  |  |
| **Stacks** | button | 5 | Stacks.tsx:401, Stacks.tsx:424, Stacks.tsx:430, Stacks.tsx:464 |  |  |
|  | card / panel | 1 | Stacks.tsx:447 |  |  |
|  | sheet / dialog / overlay | 2 | Stacks.tsx:445, Stacks.tsx:446 |  |  |
|  | loading state | 3 | Stacks.tsx:414, Stacks.tsx:480, Stacks.tsx:523 |  |  |
| **System** | button | 11 | System.tsx:203, System.tsx:213, System.tsx:230, System.tsx:250 |  | password eye button named |
|  | card / panel | 2 | System.tsx:68, System.tsx:649 |  |  |
|  | text input | 2 | System.tsx:446, System.tsx:456 |  |  |
|  | table | 1 | System.tsx:693 |  |  |
|  | loading state | 7 | System.tsx:242, System.tsx:262, System.tsx:429, System.tsx:486 |  |  |
| **Templates** | button | 64 | Templates.tsx:1057, Templates.tsx:1060, Templates.tsx:1076, Templates.tsx:1145 |  | Mantine Switch ×8 (variables, auto-start, optional services, HTTPS routing, proxy, Authelia, Homarr, limits); route checkboxes are role="checkbox" |
|  | card / panel | 1 | Templates.tsx:3764 |  |  |
|  | text input | 13 | Templates.tsx:1050, Templates.tsx:1428, Templates.tsx:1452, Templates.tsx:1492 |  |  |
|  | select | 6 | Templates.tsx:1665, Templates.tsx:1675, Templates.tsx:1775, Templates.tsx:1793 |  |  |
|  | textarea | 4 | Templates.tsx:1710, Templates.tsx:2383, Templates.tsx:2415, Templates.tsx:2727 |  |  |
|  | checkbox / switch | 10 | Templates.tsx:1414, Templates.tsx:1527, Templates.tsx:1543, Templates.tsx:1575 | Switch |  |
|  | chip / pill / badge | 4 | Templates.tsx:1863, Templates.tsx:1868, Templates.tsx:1935, Templates.tsx:2717 |  |  |
|  | table | 1 | Templates.tsx:3694 |  |  |
|  | sheet / dialog / overlay | 7 | Templates.tsx:1118, Templates.tsx:1119, Templates.tsx:2264, Templates.tsx:2265 |  |  |
|  | loading state | 22 | Templates.tsx:1061, Templates.tsx:1102, Templates.tsx:1137, Templates.tsx:1157 |  |  |
|  | empty state | 3 | Templates.tsx:2972, Templates.tsx:3691, Templates.tsx:3839 |  |  |
|  | error state | 2 | Templates.tsx:2393, Templates.tsx:3814 |  |  |
| **Terminal** | button | 6 | Terminal.tsx:481, Terminal.tsx:518, Terminal.tsx:534, Terminal.tsx:609 |  |  |
|  | text input | 1 | Terminal.tsx:665 |  |  |
|  | loading state | 3 | Terminal.tsx:438, Terminal.tsx:644, Terminal.tsx:697 |  |  |
| **Topology** | button | 3 | Topology.tsx:305, Topology.tsx:780, Topology.tsx:832 |  |  |
|  | card / panel | 7 | Topology.tsx:316, Topology.tsx:323, Topology.tsx:329, Topology.tsx:335 |  |  |
|  | chip / pill / badge | 1 | Topology.tsx:817 |  |  |
|  | sheet / dialog / overlay | 2 | Topology.tsx:280, Topology.tsx:282 |  |  |
|  | loading state | 2 | Topology.tsx:818, Topology.tsx:847 |  |  |
|  | error state | 1 | Topology.tsx:849 |  |  |
| **Trends** | button | 8 | Trends.tsx:504, Trends.tsx:520, Trends.tsx:535, Trends.tsx:562 |  | Mantine SegmentedControl (time range); auto-refresh toggle is aria-pressed |
|  | text input | 6 | Trends.tsx:746, Trends.tsx:760, Trends.tsx:786, Trends.tsx:800 |  |  |
|  | segmented / tabs | 1 | Trends.tsx:550 | SegmentedControl |  |
|  | sheet / dialog / overlay | 2 | Trends.tsx:715, Trends.tsx:716 |  |  |
|  | tooltip | 1 | Trends.tsx:258 |  |  |
|  | loading state | 4 | Trends.tsx:510, Trends.tsx:624, Trends.tsx:650, Trends.tsx:866 |  |  |
|  | empty state | 1 | Trends.tsx:639 |  |  |
|  | error state | 1 | Trends.tsx:629 |  |  |
| **Updates** | button | 14 | Updates.tsx:797, Updates.tsx:982, Updates.tsx:1063, Updates.tsx:1072 |  | Mantine Select (Automatic image updates), Switch ×2 with tooltips; Title Case header buttons ("Update All Stale", "Check Registry for Updates") |
|  | card / panel | 2 | Updates.tsx:809, Updates.tsx:1117 |  |  |
|  | select | 1 | Updates.tsx:814 |  |  |
|  | checkbox / switch | 4 | Updates.tsx:936, Updates.tsx:970, Updates.tsx:978, Updates.tsx:1313 | Switch |  |
|  | chip / pill / badge | 21 | Updates.tsx:98, Updates.tsx:221, Updates.tsx:229, Updates.tsx:237 |  |  |
|  | table | 2 | Updates.tsx:1465, Updates.tsx:1511 |  |  |
|  | tooltip | 1 | Updates.tsx:1311 | Tooltip |  |
|  | loading state | 18 | Updates.tsx:127, Updates.tsx:162, Updates.tsx:752, Updates.tsx:770 |  |  |
|  | empty state | 1 | Updates.tsx:1487 |  |  |
|  | error state | 1 | Updates.tsx:910 |  |  |
| **Uptime** | button | 2 | Uptime.tsx:503, Uptime.tsx:523 |  |  |
|  | chip / pill / badge | 9 | Uptime.tsx:255, Uptime.tsx:264, Uptime.tsx:272, Uptime.tsx:280 | Badge (VmCapsule) |  |
|  | sheet / dialog / overlay | 1 | Uptime.tsx:201 |  |  |
|  | loading state | 3 | Uptime.tsx:289, Uptime.tsx:490, Uptime.tsx:610 |  |  |
|  | empty state | 1 | Uptime.tsx:614 |  |  |
| **Users** | button | 10 | Users.tsx:241, Users.tsx:293, Users.tsx:370, Users.tsx:380 |  |  |
|  | card / panel | 7 | Users.tsx:275, Users.tsx:412, Users.tsx:420, Users.tsx:458 |  |  |
|  | text input | 2 | Users.tsx:421, Users.tsx:429 |  |  |
|  | select | 3 | Users.tsx:356, Users.tsx:437, Users.tsx:473 |  |  |
|  | chip / pill / badge | 1 | Users.tsx:562 |  |  |
|  | tooltip | 1 | Users.tsx:369 |  |  |
|  | loading state | 6 | Users.tsx:220, Users.tsx:287, Users.tsx:385, Users.tsx:451 |  |  |
|  | empty state | 2 | Users.tsx:291, Users.tsx:550 |  |  |
| **Volumes** | button | 15 | Volumes.tsx:183, Volumes.tsx:194, Volumes.tsx:284, Volumes.tsx:295 |  | select-all named; the batch rows select by a row click only, not by keyboard (see AUDIT) |
|  | card / panel | 6 | Volumes.tsx:144, Volumes.tsx:242, Volumes.tsx:692, Volumes.tsx:703 |  |  |
|  | text input | 2 | Volumes.tsx:266, Volumes.tsx:773 |  |  |
|  | chip / pill / badge | 1 | Volumes.tsx:1002 | Badge (VmCapsule) |  |
|  | table | 1 | Volumes.tsx:849 |  |  |
|  | sheet / dialog / overlay | 4 | Volumes.tsx:138, Volumes.tsx:140, Volumes.tsx:236, Volumes.tsx:238 |  |  |
|  | loading state | 9 | Volumes.tsx:76, Volumes.tsx:79, Volumes.tsx:82, Volumes.tsx:85 |  |  |
|  | error state | 2 | Volumes.tsx:177, Volumes.tsx:913 |  |  |

## Shared components

| page / component | element | count | where (file:line) | Mantine | notes |
|---|---|---:|---|---|---|
| **CommandPalette** | button | 1 | CommandPalette.tsx:953 |  |  |
|  | text input | 1 | CommandPalette.tsx:910 |  |  |
|  | chip / pill / badge | 2 | CommandPalette.tsx:976, CommandPalette.tsx:979 |  |  |
|  | sheet / dialog / overlay | 1 | CommandPalette.tsx:888 |  |  |
| **NotificationDrawer** | button | 6 | NotificationDrawer.tsx:125, NotificationDrawer.tsx:312, NotificationDrawer.tsx:329, NotificationDrawer.tsx:346 |  | Mantine Switch rows (label left, whole row toggles) |
|  | card / panel | 1 | NotificationDrawer.tsx:448 |  |  |
|  | checkbox / switch | 1 | NotificationDrawer.tsx:172 | Switch |  |
|  | sheet / dialog / overlay | 2 | NotificationDrawer.tsx:267, NotificationDrawer.tsx:273 |  |  |
| **BackToTop** | button | 1 | BackToTop.tsx:33 |  |  |
| **Badge** | — | 0 | Badge.tsx | | dead code: imported nowhere |
| **Breadcrumbs** | button | 1 | Breadcrumbs.tsx:41 |  |  |
| **Button** | button | 1 | Button.tsx:59 |  | dead code: imported nowhere |
| **Card** | — | 0 | Card.tsx | | dead code: imported nowhere |
| **ConfirmDialog** | button | 2 | ConfirmDialog.tsx:99, ConfirmDialog.tsx:106 |  | focuses the confirm button, also for danger (see AUDIT) |
|  | card / panel | 1 | ConfirmDialog.tsx:102 |  |  |
|  | sheet / dialog / overlay | 2 | ConfirmDialog.tsx:78, ConfirmDialog.tsx:80 |  |  |
| **CopyButton** | button | 1 | CopyButton.tsx:23 |  |  |
| **DiffViewer** | button | 2 | DiffViewer.tsx:186, DiffViewer.tsx:196 |  | dead code: imported nowhere |
|  | card / panel | 1 | DiffViewer.tsx:165 |  |  |
|  | table | 3 | DiffViewer.tsx:212, DiffViewer.tsx:236, DiffViewer.tsx:257 |  |  |
| **DisconnectedBanner** | button | 1 | DisconnectedBanner.tsx:35 |  |  |
|  | loading state | 1 | DisconnectedBanner.tsx:27 |  |  |
| **ErrorBoundary** | button | 2 | ErrorBoundary.tsx:39, ErrorBoundary.tsx:47 |  |  |
|  | card / panel | 1 | ErrorBoundary.tsx:30 |  |  |
| **FloatingSaveBar** | button | 2 | FloatingSaveBar.tsx:47, FloatingSaveBar.tsx:53 |  |  |
|  | sheet / dialog / overlay | 1 | FloatingSaveBar.tsx:41 |  |  |
|  | loading state | 2 | FloatingSaveBar.tsx:44, FloatingSaveBar.tsx:58 |  |  |
| **KeyboardShortcutsPanel** | button | 1 | KeyboardShortcutsPanel.tsx:77 |  |  |
|  | sheet / dialog / overlay | 2 | KeyboardShortcutsPanel.tsx:57, KeyboardShortcutsPanel.tsx:59 |  |  |
| **Modal** | button | 1 | Modal.tsx:78 |  | dead code: imported nowhere |
|  | sheet / dialog / overlay | 3 | Modal.tsx:45, Modal.tsx:50, Modal.tsx:65 |  |  |
| **OnDemandMissingBanner** | button | 1 | OnDemandMissingBanner.tsx:43 |  |  |
|  | loading state | 1 | OnDemandMissingBanner.tsx:44 |  |  |
| **OnboardingOverlay** | button | 5 | OnboardingOverlay.tsx:153, OnboardingOverlay.tsx:164, OnboardingOverlay.tsx:220, OnboardingOverlay.tsx:236 |  |  |
|  | sheet / dialog / overlay | 2 | OnboardingOverlay.tsx:139, OnboardingOverlay.tsx:140 |  |  |
| **PageState** | button | 1 | PageState.tsx:38 |  |  |
|  | loading state | 1 | PageState.tsx:12 |  |  |
| **ProgressCard** | loading state | 2 | ProgressCard.tsx:69, ProgressCard.tsx:82 |  |  |
| **ServerSwitcher** | button | 7 | ServerSwitcher.tsx:125, ServerSwitcher.tsx:169, ServerSwitcher.tsx:211, ServerSwitcher.tsx:220 |  |  |
|  | text input | 3 | ServerSwitcher.tsx:186, ServerSwitcher.tsx:247, ServerSwitcher.tsx:255 |  |  |
|  | loading state | 3 | ServerSwitcher.tsx:50, ServerSwitcher.tsx:176, ServerSwitcher.tsx:282 |  |  |
| **Skeleton** | — | 0 | Skeleton.tsx | | dead code: imported nowhere (pages use the .skeleton class) |
| **Spinner** | — | 0 | Spinner.tsx | | dead code: only the dead Button uses it |
| **Table** | table | 1 | Table.tsx:108 |  | dead code: imported nowhere |
| **Toast** | button | 3 | Toast.tsx:204, Toast.tsx:212, Toast.tsx:223 |  |  |
| **Tooltip** | sheet / dialog / overlay | 1 | Tooltip.tsx:36 |  |  |
| **UpdateBanner** | button | 2 | UpdateBanner.tsx:64, UpdateBanner.tsx:71 |  |  |
| **FleetJobsPanel** | button | 4 | FleetJobsPanel.tsx:158, FleetJobsPanel.tsx:159, FleetJobsPanel.tsx:160, FleetJobsPanel.tsx:238 |  | Mantine Progress, RingProgress, Tooltip, Text |
|  | card / panel | 1 | FleetJobsPanel.tsx:222 |  |  |
|  | tooltip | 1 | FleetJobsPanel.tsx:76 | Tooltip |  |
|  | progress / meter | 3 | FleetJobsPanel.tsx:72, FleetJobsPanel.tsx:77, FleetJobsPanel.tsx:223 | Progress, RingProgress |  |
|  | loading state | 4 | FleetJobsPanel.tsx:62, FleetJobsPanel.tsx:139, FleetJobsPanel.tsx:158, FleetJobsPanel.tsx:239 |  |  |
| **FleetLinkPanel** | button | 2 | FleetLinkPanel.tsx:115, FleetLinkPanel.tsx:136 |  |  |
|  | chip / pill / badge | 1 | FleetLinkPanel.tsx:134 |  |  |
|  | loading state | 1 | FleetLinkPanel.tsx:116 |  |  |
| **FleetScopeChips** | button | 3 | FleetScopeChips.tsx:24, FleetScopeChips.tsx:35, FleetScopeChips.tsx:43 |  | role="group", aria-pressed chips, Mantine Tooltip; kept as wrapping chips (see AUDIT) |
|  | tooltip | 3 | FleetScopeChips.tsx:23, FleetScopeChips.tsx:34, FleetScopeChips.tsx:41 | Tooltip |  |
|  | loading state | 1 | FleetScopeChips.tsx:56 |  |  |
| **JoinCodeCard** | button | 2 | JoinCodeCard.tsx:42, JoinCodeCard.tsx:76 |  |  |
|  | loading state | 2 | JoinCodeCard.tsx:43, JoinCodeCard.tsx:82 |  |  |
|  | empty state | 1 | JoinCodeCard.tsx:83 |  |  |
| **JoinHubPanel** | button | 2 | JoinHubPanel.tsx:101, JoinHubPanel.tsx:135 |  |  |
|  | text input | 3 | JoinHubPanel.tsx:116, JoinHubPanel.tsx:122, JoinHubPanel.tsx:126 |  |  |
|  | loading state | 2 | JoinHubPanel.tsx:102, JoinHubPanel.tsx:136 |  |  |
| **MemberSheet** | button | 2 | MemberSheet.tsx:137, MemberSheet.tsx:138 |  |  |
|  | text input | 4 | MemberSheet.tsx:105, MemberSheet.tsx:109, MemberSheet.tsx:113, MemberSheet.tsx:117 |  |  |
|  | select | 1 | MemberSheet.tsx:122 |  |  |
|  | checkbox / switch | 1 | MemberSheet.tsx:129 |  |  |
|  | sheet / dialog / overlay | 1 | MemberSheet.tsx:101 |  |  |
|  | loading state | 1 | MemberSheet.tsx:139 |  |  |
| **NewVmSheet** | button | 2 | NewVmSheet.tsx:278, NewVmSheet.tsx:279 |  | Mantine Select (OS, disk storage, image storage; variant="fleet"), Switch (bake); every label names its field |
|  | text input | 11 | NewVmSheet.tsx:154, NewVmSheet.tsx:175, NewVmSheet.tsx:182, NewVmSheet.tsx:189 |  |  |
|  | select | 1 | NewVmSheet.tsx:93 | Select |  |
|  | checkbox / switch | 1 | NewVmSheet.tsx:158 | Switch |  |
|  | sheet / dialog / overlay | 1 | NewVmSheet.tsx:251 |  |  |
|  | loading state | 1 | NewVmSheet.tsx:280 |  |  |
| **PlanCapacity** | tooltip | 2 | PlanCapacity.tsx:45, PlanCapacity.tsx:48 | Tooltip | Mantine Progress, Tooltip |
|  | progress / meter | 3 | PlanCapacity.tsx:44, PlanCapacity.tsx:46, PlanCapacity.tsx:49 | Progress |  |
| **VmCapsule** | chip / pill / badge | 2 | VmCapsule.tsx:17, VmCapsule.tsx:18 | Badge, Badge (VmCapsule) | Mantine Badge (button where it links) |
| **VmSizeControl** | button | 3 | VmSizeControl.tsx:53, VmSizeControl.tsx:71, VmSizeControl.tsx:92 |  | the number box sized to its digits (units fit a phone) |
|  | text input | 1 | VmSizeControl.tsx:59 |  |  |
| **fleetShared** | button | 2 | fleetShared.tsx:28, fleetShared.tsx:77 |  | Sheet: role="dialog", aria-modal, titled; no Escape (see AUDIT) |
|  | sheet / dialog / overlay | 3 | fleetShared.tsx:67, fleetShared.tsx:68, fleetShared.tsx:69 |  |  |
| **Header** | button | 11 | Header.tsx:130, Header.tsx:167, Header.tsx:304, Header.tsx:322 |  |  |
|  | card / panel | 1 | Header.tsx:118 |  |  |
|  | chip / pill / badge | 2 | Header.tsx:143, Header.tsx:288 |  |  |
|  | sheet / dialog / overlay | 2 | Header.tsx:115, Header.tsx:116 |  |  |
| **MobileNav** | button | 5 | MobileNav.tsx:66, MobileNav.tsx:83, MobileNav.tsx:109, MobileNav.tsx:117 |  |  |
|  | chip / pill / badge | 1 | MobileNav.tsx:76 |  |  |
|  | sheet / dialog / overlay | 2 | MobileNav.tsx:98, MobileNav.tsx:99 |  |  |
| **Sidebar** | button | 2 | Sidebar.tsx:333, Sidebar.tsx:381 |  |  |
|  | loading state | 4 | Sidebar.tsx:229, Sidebar.tsx:231, Sidebar.tsx:243, Sidebar.tsx:265 |  |  |
| **StatusBar** | button | 7 | StatusBar.tsx:130, StatusBar.tsx:146, StatusBar.tsx:173, StatusBar.tsx:174 |  |  |
|  | progress / meter | 2 | StatusBar.tsx:42, StatusBar.tsx:176 |  |  |
|  | loading state | 1 | StatusBar.tsx:120 |  |  |
| **AppSettings** | button | 2 | AppSettings.tsx:238, AppSettings.tsx:402 |  | Mantine Switch (sidebar collapsed, 24-hour clock, reduce motion, Discord) |
|  | text input | 3 | AppSettings.tsx:169, AppSettings.tsx:187, AppSettings.tsx:395 |  |  |
|  | select | 1 | AppSettings.tsx:295 |  |  |
|  | checkbox / switch | 5 | AppSettings.tsx:226, AppSettings.tsx:275, AppSettings.tsx:309, AppSettings.tsx:317 | Switch |  |
| **ConnectionForm** | button | 2 | ConnectionForm.tsx:131, ConnectionForm.tsx:147 |  |  |
|  | text input | 1 | ConnectionForm.tsx:95 |  |  |
|  | loading state | 3 | ConnectionForm.tsx:16, ConnectionForm.tsx:111, ConnectionForm.tsx:142 |  |  |
| **IntegrationPanels** | button | 9 | IntegrationPanels.tsx:25, IntegrationPanels.tsx:49, IntegrationPanels.tsx:52, IntegrationPanels.tsx:105 |  |  |
|  | card / panel | 5 | IntegrationPanels.tsx:45, IntegrationPanels.tsx:90, IntegrationPanels.tsx:196, IntegrationPanels.tsx:201 |  |  |
|  | text input | 1 | IntegrationPanels.tsx:234 |  |  |
|  | loading state | 4 | IntegrationPanels.tsx:53, IntegrationPanels.tsx:196, IntegrationPanels.tsx:249, IntegrationPanels.tsx:253 |  |  |
| **ThemesPanel** | button | 24 | ThemesPanel.tsx:154, ThemesPanel.tsx:255, ThemesPanel.tsx:260, ThemesPanel.tsx:261 |  |  |
|  | card / panel | 3 | ThemesPanel.tsx:342, ThemesPanel.tsx:593, ThemesPanel.tsx:617 |  |  |
|  | text input | 9 | ThemesPanel.tsx:280, ThemesPanel.tsx:293, ThemesPanel.tsx:304, ThemesPanel.tsx:308 |  |  |
|  | textarea | 2 | ThemesPanel.tsx:401, ThemesPanel.tsx:581 |  |  |
|  | chip / pill / badge | 3 | ThemesPanel.tsx:122, ThemesPanel.tsx:124, ThemesPanel.tsx:848 |  |  |
|  | sheet / dialog / overlay | 5 | ThemesPanel.tsx:141, ThemesPanel.tsx:142, ThemesPanel.tsx:144, ThemesPanel.tsx:274 |  |  |
|  | loading state | 4 | ThemesPanel.tsx:263, ThemesPanel.tsx:267, ThemesPanel.tsx:564, ThemesPanel.tsx:866 |  |  |
| **AutoImageUpdates** | button | 1 | AutoImageUpdates.tsx:163 |  | Mantine Select (xs), Switch, Tooltip |
|  | card / panel | 1 | AutoImageUpdates.tsx:133 |  |  |
|  | select | 1 | AutoImageUpdates.tsx:141 | Select |  |
|  | checkbox / switch | 1 | AutoImageUpdates.tsx:159 | Switch |  |
|  | tooltip | 1 | AutoImageUpdates.tsx:157 | Tooltip |  |
|  | loading state | 1 | AutoImageUpdates.tsx:140 |  |  |
|  | error state | 1 | AutoImageUpdates.tsx:138 |  |  |
| **DockerEngineCard** | button | 6 | DockerEngineCard.tsx:37, DockerEngineCard.tsx:233, DockerEngineCard.tsx:248, DockerEngineCard.tsx:259 |  |  |
|  | text input | 2 | DockerEngineCard.tsx:244, DockerEngineCard.tsx:246 |  |  |
|  | chip / pill / badge | 7 | DockerEngineCard.tsx:202, DockerEngineCard.tsx:204, DockerEngineCard.tsx:206, DockerEngineCard.tsx:208 | Badge (VmCapsule) |  |
|  | loading state | 7 | DockerEngineCard.tsx:171, DockerEngineCard.tsx:172, DockerEngineCard.tsx:192, DockerEngineCard.tsx:202 |  |  |

## Totals

| element | occurrences |
|---|---:|
| button | 720 |
| card / panel | 157 |
| text input | 196 |
| select | 41 |
| textarea | 13 |
| checkbox / switch | 36 |
| chip / pill / badge | 122 |
| segmented / tabs | 4 |
| table | 22 |
| sheet / dialog / overlay | 96 |
| tooltip | 19 |
| progress / meter | 14 |
| loading state | 271 |
| empty state | 35 |
| error state | 30 |
| files that draw Mantine components | 17 |

