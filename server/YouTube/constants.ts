// downloads are saved in this subfolder of the media folder with YouTube enabled
export const SUBDIR = 'YouTube'

export const isYouTubeRelPath = (relPath: string) => relPath.startsWith(SUBDIR + '/')
