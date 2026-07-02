/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'sage': '#77978E',
                'amber': '#EDB75A',
                'earth': '#5D2C12',
                'cream': '#F4E8D7',
            }
        },
    },
    plugins: [],
}
