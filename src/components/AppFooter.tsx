import Link from "next/link";

const footerSections = [
  {
    title: "Rentulo",
    links: [
      { href: "/", label: "Domov" },
      { href: "/items", label: "Ponuky" },
    ],
  },
  {
    title: "Pre používateľov",
    links: [
      { href: "/items", label: "Ako prenajímať" },
      { href: "/verification", label: "Overenie profilu" },
      { href: "/messages", label: "Správy" },
    ],
  },
  {
    title: "Kategórie",
    links: [
      { href: "/items", label: "Náradie" },
      { href: "/items", label: "Elektronika" },
      { href: "/items", label: "Šport a voľný čas" },
    ],
  },
  {
    title: "Právne informácie",
    links: [
      { href: "/", label: "Podmienky používania" },
      { href: "/", label: "Ochrana súkromia" },
      { href: "/disputes", label: "Riešenie sporov" },
    ],
  },
  {
    title: "Kontakt a dôvera",
    links: [
      { href: "/", label: "Kontakt" },
      { href: "/verification", label: "Overený profil" },
      { href: "/notifications", label: "Centrum upozornení" },
    ],
  },
];

export default function AppFooter() {
  return (
    <footer className="rentulo-footer mt-12 border-t lg:mt-16">
      <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="rentulo-footer-grid">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h2 className="rentulo-footer-heading">{section.title}</h2>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={`${section.title}-${link.label}`}>
                    <Link href={link.href} className="rentulo-footer-link">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="rentulo-footer-copy mt-8 border-t pt-5 text-sm">
          © {new Date().getFullYear()} Rentulo. Všetky práva vyhradené.
        </div>
      </div>
    </footer>
  );
}
