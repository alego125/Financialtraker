const paths = {
 eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7m10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
 'eye-off': 'm3 3 18 18M10 5a12 12 0 0 1 12 7 17 17 0 0 1-4 5M6 6a18 18 0 0 0-4 6s3 7 10 7a13 13 0 0 0 5-1M10 10a3 3 0 0 0 4 4',
 key: 'M15 7a5 5 0 1 0-5 5L3 19v2h4l2-2v-2h2l3-3m1-7h.01',
 filter: 'M3 4h18l-7 8v7l-4 2V12z',
 layers: 'm12 3 10 5-10 5L2 8zm-10 9 10 5 10-5M2 16l10 5 10-5',
 home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
 wallet: 'M20 8V5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16V8H4m16 5h-5v4h5m-3-2h.01',
 chart: 'M4 3v17h17M8 16v-5m5 5V7m5 9V4',
 trend: 'm3 17 6-6 4 4 8-10m-6 0h6v6',
 users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-7.87a4 4 0 0 1 0 7.75',
 file: 'M14 2H5v20h14V7zm0 0v6h5M8 13h8m-8 4h6',
 category: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
 calculator: 'M5 2h14v20H5zm3 4h8M8 11h1m6 0h1m-8 4h1m6 0h1m-8 4h1m6 0h1',
 user: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2m8-12a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
 menu: 'M3 6h18M3 12h18M3 18h18', close: 'm6 6 12 12M6 18 18 6',
 sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m0-6v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
 moon: 'M21 13a9 9 0 0 1-10-10A9 9 0 1 0 21 13',
 logout: 'M9 3H3v18h6m5-14 5 5-5 5m-7-5h12',
 arrow: 'M4 12h16m-6-6 6 6-6 6', left: 'm15 6-6 6 6 6', right: 'm9 6 6 6-6 6',
 transactions: 'M7 3v18m-4-4 4 4 4-4M17 21V3m-4 4 4-4 4 4',
 plus: 'M12 5v14M5 12h14', check: 'm5 12 4 4L19 6', search: 'M21 21l-5-5M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14',
};
export default function Icon({ name = 'home', size = 20, className = '', ...props }) {
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false" {...props}><path d={paths[name] || paths.home} /></svg>;
}
