'use client'

import {Github, MoreHorizontal} from 'lucide-react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'

import {ModeToggle} from '@/components/theme-toggle'
import {Button} from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function DocsMenuHeader() {
  const router = useRouter()
  return (
    <nav className="flex h-16 items-stretch">
      {/* Menu desktop - caché sur mobile */}
      <div className="hidden items-stretch lg:flex">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground border-border after:bg-foreground relative flex h-full items-center border-r px-4 text-sm transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:transition-all after:duration-500 after:ease-out after:content-[''] hover:after:w-full"
        >
          Buy
        </Link>
        <Link
          href="/docs"
          className="text-foreground border-border bg-muted/50 after:bg-foreground relative flex h-full items-center border-r px-4 text-sm font-medium after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:content-['']"
        >
          docs
        </Link>
        <Link
          href="/changelogs"
          className="text-muted-foreground hover:text-foreground border-border after:bg-foreground relative flex h-full items-center border-r px-4 text-sm transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:transition-all after:duration-500 after:ease-out after:content-[''] hover:after:w-full"
        >
          changelogs
        </Link>
        <Link
          href="/#pricing"
          className="text-muted-foreground hover:text-foreground border-border after:bg-foreground relative flex h-full items-center border-r px-4 text-sm transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:transition-all after:duration-500 after:ease-out after:content-[''] hover:after:w-full"
        >
          demo
        </Link>
        <Link
          href="/#pricing"
          className="text-muted-foreground hover:text-foreground border-border after:bg-foreground relative flex h-full items-center border-r px-4 text-sm transition-colors after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-0 after:transition-all after:duration-500 after:ease-out after:content-[''] hover:after:w-full"
        >
          community
        </Link>
      </div>

      {/* Menu mobile - dropdown avec 3 points */}
      <div className="border-border border-r lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-full rounded-none px-4"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/#pricing" className="w-full">
                Buy
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/docs" className="w-full font-medium">
                docs
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/changelogs" className="w-full">
                changelogs
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/" className="w-full">
                demo
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/#pricing" className="w-full">
                community
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="border-border flex h-full items-center border-r">
        <Button
          variant="ghost"
          size="sm"
          className="h-full w-12 cursor-pointer rounded-none"
          onClick={() => router.push('/')}
        >
          <Github className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex h-full items-center">
        <div className="flex h-full w-12 items-center justify-center border-0">
          <ModeToggle />
        </div>
      </div>
    </nav>
  )
}
