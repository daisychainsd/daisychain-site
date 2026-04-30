import {
  siInstagram,
  siYoutube,
  siBandcamp,
  siSoundcloud,
} from "simple-icons";
import { IconSocialLink } from "@/components/BrandIcon";

export default function Footer() {
  return (
    <footer className="zone-abyss mt-20">
      <div className="divider-glow" />
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="container-organic p-8 sm:p-10">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-8">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <img src="/flower-white.png" alt="" className="w-5 h-5 opacity-50" />
                <span className="text-lg font-bold tracking-tight">DAISY CHAIN</span>
              </div>
              <p className="text-text-secondary text-sm max-w-xs">
                Independent electronic music label based in San Diego, California.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center justify-end">
              <IconSocialLink
                href="https://instagram.com/daisychainsd"
                label="Instagram"
                icon={siInstagram}
              />
              <IconSocialLink
                href="https://www.youtube.com/@DaisyChain-sd"
                label="YouTube"
                icon={siYoutube}
              />
              <IconSocialLink
                href="https://daisychainsd.bandcamp.com"
                label="Bandcamp"
                icon={siBandcamp}
              />
              <IconSocialLink
                href="https://soundcloud.com/daisychainsd"
                label="SoundCloud"
                icon={siSoundcloud}
              />
            </div>
          </div>
          <div className="divider-glow mt-8 mb-6" />
          <p className="text-text-muted text-sm">
            &copy; {new Date().getFullYear()} Daisy Chain Records. San Diego, CA.
          </p>
        </div>
      </div>
    </footer>
  );
}
