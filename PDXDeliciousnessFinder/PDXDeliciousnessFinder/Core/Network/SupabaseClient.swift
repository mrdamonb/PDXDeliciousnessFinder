import Supabase
import Foundation

// Shared Supabase client. Reads credentials from Info.plist, which are
// populated from Config.xcconfig at build time via build settings.
//
// If this crashes with the message below, complete the xcconfig wiring:
//   1. Drag Config/Config.xcconfig into the Xcode project navigator.
//   2. Select the PROJECT → Info → Configurations → set Debug + Release to "Config".
//   3. Add SUPABASE_URL and SUPABASE_ANON_KEY keys to Info.plist with values
//      $(SUPABASE_URL) and $(SUPABASE_ANON_KEY) respectively.
let supabase: SupabaseClient = {
    guard
        let info = Bundle.main.infoDictionary,
        let host = info["SUPABASE_HOST"] as? String, !host.isEmpty,
        let anonKey = info["SUPABASE_ANON_KEY"] as? String, !anonKey.isEmpty,
        let url = URL(string: "https://\(host)")
    else {
        fatalError(
            """
            Missing Supabase configuration.
            Add SUPABASE_HOST and SUPABASE_ANON_KEY to Info.plist.
            See Config/Config.xcconfig.example for full setup instructions.
            """
        )
    }
    return SupabaseClient(supabaseURL: url, supabaseKey: anonKey)
}()
