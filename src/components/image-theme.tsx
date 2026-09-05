import type {ImageProps} from 'next/image'
import Image from 'next/image'

import {cn} from '@/lib/utils'

type ImageThemeProps = ImageProps & {srcDark: string}

export default function ImageTheme(props: ImageThemeProps) {
  const {src, srcDark, className, ...rest} = props

  return (
    <>
      <Image
        src={src}
        {...rest}
        className={cn(className, 'block dark:hidden')}
        alt=""
      />
      <Image
        src={srcDark}
        {...rest}
        className={cn(className, 'hidden dark:block')}
        alt=""
      />
    </>
  )
  //return <Image {...rest} src={srcDetected} />
}
