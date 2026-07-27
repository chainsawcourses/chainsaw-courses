export default function DownloadApp() {
  // TODO: Replace with real store URLs once submitted
  const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.chainsawcourses.app";
  const APP_STORE_URL = ""; // Coming soon — requires Apple Developer account

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Brand bar */}
      <div className="bg-[#e27226] h-1.5 w-full" />

      <div className="flex-1 flex flex-col items-center px-5 py-10 max-w-sm mx-auto w-full">

        {/* App icon */}
        <div className="w-28 h-28 rounded-[24px] shadow-2xl overflow-hidden border border-gray-100 mb-5">
          <img src="/icon-512.png" alt="Chainsaw Courses" className="w-full h-full object-cover" />
        </div>

        {/* Identity */}
        <h1 className="text-2xl font-black text-gray-900 text-center tracking-tight">
          Chainsaw Courses
        </h1>
        <p className="text-[#e27226] font-bold text-sm mt-1 text-center uppercase tracking-wider">
          IIRSM-Approved Professional Training
        </p>

        {/* Ratings row */}
        <div className="flex items-center gap-1.5 mt-3 mb-8">
          {[1,2,3,4,5].map(n => (
            <svg key={n} className="w-4 h-4 text-[#e27226]" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
          <span className="text-xs text-gray-500 ml-1">IIRSM Approved</span>
        </div>

        {/* Google Play button */}
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full mb-3"
        >
          <div className="w-full flex items-center gap-4 bg-black hover:bg-gray-900 text-white rounded-xl px-5 py-3.5 transition-colors">
            {/* Google Play icon */}
            <svg className="w-7 h-7 flex-shrink-0" viewBox="0 0 24 24" fill="none">
              <path d="M3.18 23.76c.3.16.64.22.98.17l12.69-12.68L13.37 7.8 3.18 23.76z" fill="#EA4335"/>
              <path d="M20.96 10.22l-2.79-1.6-3.8 3.62 3.8 3.63 2.82-1.62a1.65 1.65 0 000-4.03z" fill="#FBBC05"/>
              <path d="M3.18.24a1.64 1.64 0 00-.18.75v22.02c0 .26.06.51.18.75l.1.09 12.32-12.31v-.29L3.28.15l-.1.09z" fill="#4285F4"/>
              <path d="M16.85 11.25L3.18 23.76c.3.22.7.27 1.06.12l15.12-8.65-2.51-1.98z" fill="#34A853"/>
            </svg>
            <div className="flex-1">
              <p className="text-[10px] text-gray-400 leading-none mb-0.5">GET IT ON</p>
              <p className="text-lg font-semibold leading-none">Google Play</p>
            </div>
          </div>
        </a>

        {/* App Store button — coming soon */}
        <div className="w-full mb-8 relative">
          <div className="w-full flex items-center gap-4 bg-black text-white rounded-xl px-5 py-3.5 opacity-40 select-none">
            {/* Apple icon */}
            <svg className="w-7 h-7 flex-shrink-0" viewBox="0 0 24 24" fill="white">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <div className="flex-1">
              <p className="text-[10px] text-gray-400 leading-none mb-0.5">DOWNLOAD ON THE</p>
              <p className="text-lg font-semibold leading-none">App Store</p>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-gray-700 text-white text-xs font-bold px-3 py-1 rounded-full">Coming Soon</span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full border-t border-gray-100 mb-8" />

        {/* What's included */}
        <div className="w-full mb-8">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">What's included</h2>
          <ul className="space-y-2.5">
            {[
              "34 training videos",
              "Physical chainsaw manual",
              "Per-module quizzes with instant feedback",
              "AI mock examiner for exam practice",
              "Inspection checklists & risk assessments",
              "Digital certificate on completion",
              "Bio-security maps",
              "Species identification guides",
              "Timber characteristics",
              "Glossary & reference tools",
            ].map((text) => (
              <li key={text} className="flex items-start gap-2.5">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#e27226] flex-shrink-0" />
                <span className="text-sm text-gray-700">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Trust row */}
        <div className="w-full bg-gray-50 rounded-2xl border border-gray-100 px-5 py-4 flex items-center justify-around text-center mb-8">
          <div>
            <p className="text-xl font-black text-[#e27226]">IIRSM</p>
            <p className="text-xs text-gray-500 mt-0.5">Approved</p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <p className="text-xl font-black text-[#e27226]">7</p>
            <p className="text-xs text-gray-500 mt-0.5">Modules</p>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <p className="text-xl font-black text-[#e27226]">CS30/31</p>
            <p className="text-xs text-gray-500 mt-0.5">Prep</p>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center pb-4">
          Already purchased?{" "}
          <span className="text-gray-500">Download the app and enter your access code to get started.</span>
        </p>

        <a
          href="https://chainsawcourses.com"
          className="text-xs text-gray-400 underline underline-offset-2 mb-8"
        >
          chainsawcourses.com
        </a>

        {/* Admin access */}
        <a
          href="/admin"
          className="text-xs text-gray-300 hover:text-gray-400 transition-colors pb-8"
        >
          Admin
        </a>
      </div>
    </div>
  );
}
