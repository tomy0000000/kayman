import { Icon } from '@iconify-icon/react'
import Image from 'next/image'
import { useState } from 'react'

import Logo from '@/components/logo'
import { Sidebar, SidebarBody, SidebarLink } from '@/components/ui/sidebar'

const links = [
  {
    label: 'Calendar',
    href: '/',
    icon: <Icon icon="mdi:calendar" />
  },
  {
    label: 'Account',
    href: '/account',
    icon: <Icon icon="mdi:account-balance-wallet" />
  },
  {
    label: 'Category',
    href: '/category',
    icon: <Icon icon="mdi:category" />
  }
]
export default function AppSidebar() {
  const [open, setOpen] = useState(false)
  return (
    <Sidebar open={open} setOpen={setOpen} animate={false}>
      <SidebarBody className="justify-between gap-10">
        <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          <>
            <Logo />
          </>
          <div className="mt-8 flex flex-col gap-2">
            {links.map((link, idx) => (
              <SidebarLink key={idx} link={link} />
            ))}
          </div>
        </div>
        <div>
          <SidebarLink
            link={{
              label: 'Tomy Hsieh',
              href: '/setting',
              icon: (
                <Image
                  src="https://img.tomy.me/tomy-light.png"
                  className="h-7 w-7 flex-shrink-0 rounded-full"
                  width={50}
                  height={50}
                  alt="Avatar"
                />
              )
            }}
          />
        </div>
      </SidebarBody>
    </Sidebar>
  )
}
