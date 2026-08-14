# Physical prerequisites

Nothing in this list has been performed by this build run.

1. One Mac capable of running current Chrome, with a brand-new Chrome profile
   named `SCINTILLA X TEST LAB`. It must not be Alan's normal Chrome profile or
   the controlled stable Station group.
2. The test profile must have its own profile directory, its own cookies, its
   own extension registry, and no loaded copy of the stable Station X Bridge.
3. One dedicated `https://x.com/` source tab inside that test profile. Any X
   sign-in must be performed manually in that profile; no stable source tab or
   stable profile cookie may be reused.
4. The public testing project must serve the handed-off receiver at exactly
   `https://scintilla-station-testing-surface.vercel.app/pane-x/`. A preview
   alias, production Station host, localhost, or another Vercel project will be
   rejected by both the manifest and runtime host gates.
5. One desktop testing-surface tab in the test profile. Its X pane must resolve
   to the testing receiver above.
6. One iPad with network access to Supabase Realtime and Safari capable of
   opening the lab pair link produced by the testing receiver. The link goes
   directly to the testing `/pane-x/` remote receiver; it does not use the
   durable stable iPad pair.
7. The desktop and iPad clocks should be reasonably current. WebRTC remains
   local/peer-to-peer, but Realtime signaling needs working internet access.
8. A human must be present for Chrome's unpacked-extension load, X sign-in, the
   explicit tab-capture gesture, and iPad link transfer. None can be automated
   safely from stable state.

Hard stop: if the extension ID is not
`jdefdcaphfolchojienigeeajfpinlfp`, the tab title does not clearly say testing,
the URL host differs, or the diagnostics strip is absent, do not activate the
capture.
