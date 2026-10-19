/**
 * The app's single icon set (Phosphor). Components import icons by the names
 * below; swap an icon for the whole app by changing its mapping here.
 */
import type { ComponentType } from 'react';
import type { Icon, IconProps } from '@phosphor-icons/react';
import {
  ArrowCounterClockwiseIcon as PhArrowCounterClockwise,
  ArrowLeftIcon as PhArrowLeft,
  ArrowSquareOutIcon as PhArrowSquareOut,
  ArrowUpRightIcon as PhArrowUpRight,
  ArrowsClockwiseIcon as PhArrowsClockwise,
  ArrowsDownUpIcon as PhArrowsDownUp,
  BankIcon as PhBank,
  BellIcon as PhBell,
  BellRingingIcon as PhBellRinging,
  BookOpenIcon as PhBookOpen,
  BrainIcon as PhBrain,
  BroadcastIcon as PhBroadcast,
  BuildingsIcon as PhBuildings,
  CalendarIcon as PhCalendar,
  CalendarDotsIcon as PhCalendarDots,
  CaretDownIcon as PhCaretDown,
  CaretLeftIcon as PhCaretLeft,
  CaretRightIcon as PhCaretRight,
  CaretUpIcon as PhCaretUp,
  ChartBarIcon as PhChartBar,
  ChartLineIcon as PhChartLine,
  ChartPieIcon as PhChartPie,
  ChatTextIcon as PhChatText,
  CheckIcon as PhCheck,
  CheckCircleIcon as PhCheckCircle,
  CircleIcon as PhCircle,
  CircleNotchIcon as PhCircleNotch,
  ClipboardTextIcon as PhClipboardText,
  ClockIcon as PhClock,
  ClockCounterClockwiseIcon as PhClockCounterClockwise,
  CloudArrowUpIcon as PhCloudArrowUp,
  CompassIcon as PhCompass,
  CrownIcon as PhCrown,
  DatabaseIcon as PhDatabase,
  DotsThreeIcon as PhDotsThree,
  DownloadSimpleIcon as PhDownloadSimple,
  DropIcon as PhDrop,
  EnvelopeIcon as PhEnvelope,
  EyeIcon as PhEye,
  EyeSlashIcon as PhEyeSlash,
  FileArrowUpIcon as PhFileArrowUp,
  FileMagnifyingGlassIcon as PhFileMagnifyingGlass,
  FileTextIcon as PhFileText,
  FilesIcon as PhFiles,
  FolderIcon as PhFolder,
  FunnelIcon as PhFunnel,
  GearIcon as PhGear,
  HardDriveIcon as PhHardDrive,
  HardDrivesIcon as PhHardDrives,
  HeartIcon as PhHeart,
  HeartbeatIcon as PhHeartbeat,
  ImageIcon as PhImage,
  InfoIcon as PhInfo,
  KeyIcon as PhKey,
  LightbulbIcon as PhLightbulb,
  ListIcon as PhList,
  ListChecksIcon as PhListChecks,
  LockIcon as PhLock,
  MagnifyingGlassIcon as PhMagnifyingGlass,
  MagnifyingGlassMinusIcon as PhMagnifyingGlassMinus,
  MagnifyingGlassPlusIcon as PhMagnifyingGlassPlus,
  MapPinIcon as PhMapPin,
  MedalIcon as PhMedal,
  MoonIcon as PhMoon,
  NoteIcon as PhNote,
  PauseIcon as PhPause,
  PhoneIcon as PhPhone,
  PlayIcon as PhPlay,
  PlusIcon as PhPlus,
  PrinterIcon as PhPrinter,
  ProhibitIcon as PhProhibit,
  PulseIcon as PhPulse,
  ScanIcon as PhScan,
  ShieldIcon as PhShield,
  ShieldCheckIcon as PhShieldCheck,
  ShieldPlusIcon as PhShieldPlus,
  ShieldWarningIcon as PhShieldWarning,
  SignInIcon as PhSignIn,
  SignOutIcon as PhSignOut,
  SkipBackIcon as PhSkipBack,
  SkipForwardIcon as PhSkipForward,
  SlidersHorizontalIcon as PhSlidersHorizontal,
  SparkleIcon as PhSparkle,
  SquaresFourIcon as PhSquaresFour,
  StackIcon as PhStack,
  StethoscopeIcon as PhStethoscope,
  SunIcon as PhSun,
  TrashIcon as PhTrash,
  TrendUpIcon as PhTrendUp,
  UploadSimpleIcon as PhUploadSimple,
  UserIcon as PhUser,
  UserCircleIcon as PhUserCircle,
  UserPlusIcon as PhUserPlus,
  UsersIcon as PhUsers,
  UsersThreeIcon as PhUsersThree,
  WarningIcon as PhWarning,
  WarningCircleIcon as PhWarningCircle,
  WaveformIcon as PhWaveform,
  XIcon as PhX,
  XCircleIcon as PhXCircle,
  SealCheckIcon as PhSealCheck,
  FlaskIcon as PhFlask,
  GraduationCapIcon as PhGraduationCap,
  HouseIcon as PhHouse,
  RadioactiveIcon as PhRadioactive,
} from '@phosphor-icons/react/ssr';

export type AppIcon = ComponentType<IconProps>;
export type { IconProps };

// 24px default box like the previous set; Tailwind h-/w- classes still win.
function icon(Ph: Icon, name: string): AppIcon {
  const C = (props: IconProps) => <Ph size={24} {...props} />;
  C.displayName = name;
  return C;
}

export const Activity = icon(PhPulse, 'Activity');
export const AlertCircle = icon(PhWarningCircle, 'AlertCircle');
export const AlertTriangle = icon(PhWarning, 'AlertTriangle');
export const ArrowLeft = icon(PhArrowLeft, 'ArrowLeft');
export const ArrowUpDown = icon(PhArrowsDownUp, 'ArrowUpDown');
export const ArrowUpRight = icon(PhArrowUpRight, 'ArrowUpRight');
export const Award = icon(PhMedal, 'Award');
export const Ban = icon(PhProhibit, 'Ban');
export const BarChart3 = icon(PhChartBar, 'BarChart3');
export const Bell = icon(PhBell, 'Bell');
export const BellRing = icon(PhBellRinging, 'BellRing');
export const BookOpen = icon(PhBookOpen, 'BookOpen');
export const Brain = icon(PhBrain, 'Brain');
export const BrainCircuit = icon(PhBrain, 'BrainCircuit');
export const Building2 = icon(PhBuildings, 'Building2');
export const Calendar = icon(PhCalendar, 'Calendar');
export const CalendarDays = icon(PhCalendarDots, 'CalendarDays');
export const Check = icon(PhCheck, 'Check');
export const CheckCircle = icon(PhCheckCircle, 'CheckCircle');
export const CheckCircle2 = icon(PhCheckCircle, 'CheckCircle2');
export const CheckIcon = icon(PhCheck, 'CheckIcon');
export const ChevronDown = icon(PhCaretDown, 'ChevronDown');
export const ChevronDownIcon = icon(PhCaretDown, 'ChevronDownIcon');
export const ChevronLeft = icon(PhCaretLeft, 'ChevronLeft');
export const ChevronRight = icon(PhCaretRight, 'ChevronRight');
export const ChevronRightIcon = icon(PhCaretRight, 'ChevronRightIcon');
export const ChevronUpIcon = icon(PhCaretUp, 'ChevronUpIcon');
export const CircleCheckIcon = icon(PhCheckCircle, 'CircleCheckIcon');
export const CircleIcon = icon(PhCircle, 'CircleIcon');
export const ClipboardList = icon(PhClipboardText, 'ClipboardList');
export const Clock = icon(PhClock, 'Clock');
export const Compass = icon(PhCompass, 'Compass');
export const Crown = icon(PhCrown, 'Crown');
export const Database = icon(PhDatabase, 'Database');
export const Download = icon(PhDownloadSimple, 'Download');
export const Droplet = icon(PhDrop, 'Droplet');
export const Droplets = icon(PhDrop, 'Droplets');
export const ExternalLink = icon(PhArrowSquareOut, 'ExternalLink');
export const Eye = icon(PhEye, 'Eye');
export const EyeOff = icon(PhEyeSlash, 'EyeOff');
export const FileCheck = icon(PhFileText, 'FileCheck');
export const FileSearch = icon(PhFileMagnifyingGlass, 'FileSearch');
export const FileStack = icon(PhFiles, 'FileStack');
export const FileText = icon(PhFileText, 'FileText');
export const FileUp = icon(PhFileArrowUp, 'FileUp');
export const Filter = icon(PhFunnel, 'Filter');
export const Folder = icon(PhFolder, 'Folder');
export const HardDrive = icon(PhHardDrive, 'HardDrive');
export const Heart = icon(PhHeart, 'Heart');
export const HeartPulse = icon(PhHeartbeat, 'HeartPulse');
export const History = icon(PhClockCounterClockwise, 'History');
export const Image = icon(PhImage, 'Image');
export const Info = icon(PhInfo, 'Info');
export const InfoIcon = icon(PhInfo, 'InfoIcon');
export const Key = icon(PhKey, 'Key');
export const KeyRound = icon(PhKey, 'KeyRound');
export const Landmark = icon(PhBank, 'Landmark');
export const Layers = icon(PhStack, 'Layers');
export const LayoutGrid = icon(PhSquaresFour, 'LayoutGrid');
export const Lightbulb = icon(PhLightbulb, 'Lightbulb');
export const LineChart = icon(PhChartLine, 'LineChart');
export const List = icon(PhList, 'List');
export const ListChecks = icon(PhListChecks, 'ListChecks');
export const Loader2 = icon(PhCircleNotch, 'Loader2');
export const Loader2Icon = icon(PhCircleNotch, 'Loader2Icon');
export const Lock = icon(PhLock, 'Lock');
export const LogIn = icon(PhSignIn, 'LogIn');
export const LogOut = icon(PhSignOut, 'LogOut');
export const Mail = icon(PhEnvelope, 'Mail');
export const MapPin = icon(PhMapPin, 'MapPin');
export const Menu = icon(PhList, 'Menu');
export const MessageSquareText = icon(PhChatText, 'MessageSquareText');
export const Moon = icon(PhMoon, 'Moon');
export const MoreHorizontal = icon(PhDotsThree, 'MoreHorizontal');
export const MoveUpRight = icon(PhArrowUpRight, 'MoveUpRight');
export const OctagonXIcon = icon(PhXCircle, 'OctagonXIcon');
export const Pause = icon(PhPause, 'Pause');
export const Phone = icon(PhPhone, 'Phone');
export const PieChart = icon(PhChartPie, 'PieChart');
export const Play = icon(PhPlay, 'Play');
export const Plus = icon(PhPlus, 'Plus');
export const Printer = icon(PhPrinter, 'Printer');
export const RadioTower = icon(PhBroadcast, 'RadioTower');
export const RefreshCw = icon(PhArrowsClockwise, 'RefreshCw');
export const RotateCcw = icon(PhArrowCounterClockwise, 'RotateCcw');
export const Scan = icon(PhScan, 'Scan');
export const ScanLine = icon(PhScan, 'ScanLine');
export const ScanSearch = icon(PhMagnifyingGlassPlus, 'ScanSearch');
export const Search = icon(PhMagnifyingGlass, 'Search');
export const Server = icon(PhHardDrives, 'Server');
export const Settings = icon(PhGear, 'Settings');
export const Shield = icon(PhShield, 'Shield');
export const ShieldAlert = icon(PhShieldWarning, 'ShieldAlert');
export const ShieldCheck = icon(PhShieldCheck, 'ShieldCheck');
export const ShieldPlus = icon(PhShieldPlus, 'ShieldPlus');
export const SkipBack = icon(PhSkipBack, 'SkipBack');
export const SkipForward = icon(PhSkipForward, 'SkipForward');
export const SlidersHorizontal = icon(PhSlidersHorizontal, 'SlidersHorizontal');
export const Sparkles = icon(PhSparkle, 'Sparkles');
export const Stethoscope = icon(PhStethoscope, 'Stethoscope');
export const StickyNote = icon(PhNote, 'StickyNote');
export const Sun = icon(PhSun, 'Sun');
export const Trash2 = icon(PhTrash, 'Trash2');
export const TrendingUp = icon(PhTrendUp, 'TrendingUp');
export const TriangleAlertIcon = icon(PhWarning, 'TriangleAlertIcon');
export const Upload = icon(PhUploadSimple, 'Upload');
export const UploadCloud = icon(PhCloudArrowUp, 'UploadCloud');
export const User = icon(PhUser, 'User');
export const UserPlus = icon(PhUserPlus, 'UserPlus');
export const UserRound = icon(PhUserCircle, 'UserRound');
export const Users = icon(PhUsers, 'Users');
export const UsersRound = icon(PhUsersThree, 'UsersRound');
export const Waves = icon(PhWaveform, 'Waves');
export const X = icon(PhX, 'X');
export const XCircle = icon(PhXCircle, 'XCircle');
export const XIcon = icon(PhX, 'XIcon');
export const ZoomIn = icon(PhMagnifyingGlassPlus, 'ZoomIn');
export const ZoomOut = icon(PhMagnifyingGlassMinus, 'ZoomOut');
export const BadgeCheck = icon(PhSealCheck, 'BadgeCheck');
export const FlaskConical = icon(PhFlask, 'FlaskConical');
export const GraduationCap = icon(PhGraduationCap, 'GraduationCap');
export const Home = icon(PhHouse, 'Home');
export const Radioactive = icon(PhRadioactive, 'Radioactive');
