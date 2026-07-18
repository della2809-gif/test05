import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  Clock3,
  HeartPulse,
  Menu,
  MoonStar,
  MoveUpRight,
  Salad,
  Sparkles,
  Sprout,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import styles from "./page.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ??
    headerList.get("host") ??
    "localhost:3010";
  const forwardedProtocol = headerList.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : host.startsWith("localhost")
        ? "http"
        : "https";
  const ogImage = new URL("/og.png", `${protocol}://${host}`).toString();

  return {
    title: "WELLSET | 일상의 건강을 나의 자산으로",
    description:
      "건강한 루틴, 뷰티 인사이트, AI 활용법을 배우고 나만의 웰니스 패시브인컴을 설계하는 WELLSET 매거진.",
    keywords: ["웰셋", "건강", "뷰티", "패시브인컴", "웰니스", "건강자산"],
    openGraph: {
      title: "WELLSET | 일상의 건강을 나의 자산으로",
      description:
        "더 건강하게 살고, 더 오래 나누고, 더 똑똑하게 수익화하는 웰니스 라이프.",
      type: "website",
      locale: "ko_KR",
      images: [{ url: ogImage, width: 1733, height: 909, alt: "WELLSET" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "WELLSET | 일상의 건강을 나의 자산으로",
      description:
        "더 건강하게 살고, 더 오래 나누고, 더 똑똑하게 수익화하는 웰니스 라이프.",
      images: [ogImage],
    },
  };
}

const articles = [
  {
    category: "건강 자산",
    title: "건강은 복리로 쌓인다: 오늘 시작하는 5가지 작은 입금",
    excerpt:
      "수면, 물, 걷기, 영양, 기록. 거창한 계획보다 매일 반복되는 작은 선택이 더 큰 자산이 됩니다.",
    readTime: "6분",
    tone: "sage",
    icon: TrendingUp,
  },
  {
    category: "뷰티 루틴",
    title: "비싼 화장품보다 먼저, 피부 컨디션을 바꾸는 저녁 습관",
    excerpt:
      "윤기는 바르는 것만으로 완성되지 않습니다. 수면과 수분, 장 건강을 연결해 루틴을 다시 설계해요.",
    readTime: "5분",
    tone: "coral",
    icon: Sparkles,
  },
  {
    category: "AI & 콘텐츠",
    title: "내 건강 경험을 신뢰받는 콘텐츠로 바꾸는 AI 질문법",
    excerpt:
      "경험은 살리고 과장은 덜어내는 프롬프트. 꾸준히 읽히는 웰니스 콘텐츠의 구조를 공개합니다.",
    readTime: "8분",
    tone: "lavender",
    icon: Bot,
  },
];

const categories = [
  {
    name: "건강 자산",
    description: "수면·영양·운동을 오래 가는 자산으로",
    icon: HeartPulse,
    color: "green",
  },
  {
    name: "뷰티 & 웰에이징",
    description: "겉과 속을 함께 돌보는 현실적인 루틴",
    icon: Sparkles,
    color: "pink",
  },
  {
    name: "AI 활용",
    description: "기록과 경험을 콘텐츠로 바꾸는 방법",
    icon: Bot,
    color: "purple",
  },
  {
    name: "패시브인컴",
    description: "나만의 지식 자산을 수익 흐름으로",
    icon: WalletCards,
    color: "yellow",
  },
];

const categoryGuides = [
  {
    category: "건강 루틴",
    keyword: "혈당 관리",
    title: "식후 혈당 스파이크를 줄이는 식사 순서 5가지",
    excerpt:
      "무엇을 먹을지보다 어떤 순서로 먹을지가 먼저입니다. 오늘 식사부터 적용할 수 있는 현실적인 방법을 정리했어요.",
    tone: "mint",
    number: "01",
  },
  {
    category: "이너뷰티",
    keyword: "피부 장벽",
    title: "피부 장벽이 무너졌을 때 먼저 바꿔야 할 저녁 습관",
    excerpt:
      "화장품을 더하기 전에 수면과 수분, 실내 환경을 점검하는 순서를 알려드립니다.",
    tone: "peach",
    number: "02",
  },
  {
    category: "AI 콘텐츠",
    keyword: "ChatGPT 블로그",
    title: "내 건강 경험을 블로그 글로 바꾸는 AI 질문 7단계",
    excerpt:
      "과장 없이 경험은 살리고, 검색되는 제목과 읽히는 구조를 만드는 프롬프트를 공개합니다.",
    tone: "lilac",
    number: "03",
  },
  {
    category: "건강 패시브인컴",
    keyword: "웰니스 수익화",
    title: "건강 패시브인컴, 무엇부터 콘텐츠로 만들어야 할까?",
    excerpt:
      "내가 이미 알고 있는 루틴을 글, 가이드, 추천 콘텐츠로 연결하는 가장 작은 시작점입니다.",
    tone: "butter",
    number: "04",
  },
  {
    category: "웰니스 마케팅",
    keyword: "건강 콘텐츠",
    title: "신뢰를 잃지 않는 건강 제품 추천 콘텐츠 작성법",
    excerpt:
      "효능을 단정하지 않으면서도 독자가 행동하게 만드는 경험·근거·CTA의 배치법을 살펴봅니다.",
    tone: "forest",
    number: "05",
  },
];

const pathSteps = [
  {
    number: "01",
    title: "나의 웰니스 경험을 찾고",
    text: "꾸준히 해온 루틴과 진짜 변화를 기록합니다.",
  },
  {
    number: "02",
    title: "신뢰받는 콘텐츠로 만들고",
    text: "건강한 기준과 AI 도구로 쉽게 읽히게 정리합니다.",
  },
  {
    number: "03",
    title: "오래 가는 수익 구조로 연결해요",
    text: "콘텐츠, 커뮤니티, 추천을 나답게 쌓아갑니다.",
  },
];

export default function Home() {
  return (
    <div className={styles.site}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.logo} aria-label="WELLSET 홈">
            WELLSET<span className={styles.logoDot}>.</span>
          </Link>

          <nav className={styles.desktopNav} aria-label="주요 메뉴">
            <a href="#articles">읽을거리</a>
            <a href="#categories">카테고리</a>
            <a href="#journey">웰셋 시작하기</a>
            <a href="#about">소개</a>
          </nav>

          <div className={styles.headerActions}>
            <Link href="/login" className={styles.loginLink}>
              로그인
            </Link>
            <Link href="/signup" className={styles.headerCta}>
              무료로 시작하기
              <ArrowUpRight size={16} strokeWidth={2} />
            </Link>
          </div>

          <details className={styles.mobileMenu}>
            <summary aria-label="메뉴 열기">
              <Menu className={styles.menuOpen} size={24} />
              <X className={styles.menuClose} size={24} />
            </summary>
            <nav aria-label="모바일 메뉴">
              <a href="#articles">읽을거리</a>
              <a href="#categories">카테고리</a>
              <a href="#journey">웰셋 시작하기</a>
              <a href="#about">소개</a>
              <Link href="/login">로그인</Link>
              <Link href="/signup" className={styles.mobileCta}>
                무료로 시작하기
              </Link>
            </nav>
          </details>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <div className={styles.eyebrow}>
                <span className={styles.eyebrowMark}>
                  <Sprout size={15} />
                </span>
                HEALTH · BEAUTY · PASSIVE INCOME
              </div>
              <h1>
                잘 사는 습관이
                <br />
                <em>나의 자산</em>이 되도록.
              </h1>
              <p className={styles.heroDescription}>
                건강과 뷰티를 더 깊이 이해하고, 나만의 경험을 콘텐츠와
                수익으로 연결하는 새로운 웰니스 라이프를 시작하세요.
              </p>
              <div className={styles.heroButtons}>
                <a href="#articles" className={styles.primaryButton}>
                  최신 글 둘러보기
                  <ArrowRight size={18} />
                </a>
                <a href="#journey" className={styles.textButton}>
                  웰셋이 처음이라면
                  <MoveUpRight size={17} />
                </a>
              </div>
              <div className={styles.heroTrust}>
                <div className={styles.avatarStack} aria-hidden="true">
                  <span>H</span>
                  <span>B</span>
                  <span>AI</span>
                </div>
                <p>
                  <strong>검색에서 발견되고, 경험으로 신뢰받는 콘텐츠</strong>
                  <span>건강 · 뷰티 · AI · 패시브인컴을 한 흐름으로 연결해요</span>
                </p>
              </div>
            </div>

            <div className={styles.heroVisual} aria-label="웰셋 건강 루틴 카드">
              <div className={styles.visualOrb} aria-hidden="true" />
              <div className={styles.visualCard}>
                <div className={styles.visualHeader}>
                  <span>MY WELLNESS NOTE</span>
                  <span>JUL · 2026</span>
                </div>
                <div className={`${styles.visualArtwork} ${styles.mascotArtwork}`}>
                  <Image
                    src="/wellset-mascot-portrait.png"
                    alt="윙크하며 엄지를 든 WELLSET 건강 자산 마스코트"
                    width={1254}
                    height={1254}
                    className={styles.mascotImage}
                    priority
                  />
                </div>
                <div className={styles.visualFooter}>
                  <div>
                    <strong>건강 자산 메이트</strong>
                    <span>건강한 루틴을 함께 만드는 WELLSET 친구</span>
                  </div>
                  <div className={styles.scoreCircle}>
                    <span>+23</span>
                    STACK
                  </div>
                </div>
              </div>

              <div className={styles.floatingCard}>
                <span className={styles.floatingIcon}>
                  <Check size={16} strokeWidth={3} />
                </span>
                <span>
                  <small>오늘의 루틴</small>
                  건강 자산 입금 완료
                </span>
              </div>

              <div className={styles.verticalNote}>BEAUTY FROM WITHIN</div>
            </div>
          </div>

          <div className={styles.topicTicker} aria-label="주요 주제">
            <span>수면 루틴</span>
            <i />
            <span>이너뷰티</span>
            <i />
            <span>건강 자산</span>
            <i />
            <span>AI 콘텐츠</span>
            <i />
            <span>웰니스 수익화</span>
          </div>
        </section>

        <section className={styles.articlesSection} id="articles">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionKicker}>WEEKLY CURATION</p>
              <h2>이번 주, 꼭 읽어볼 이야기</h2>
            </div>
            <a href="#categories" className={styles.viewAll}>
              모든 글 보기
              <ArrowRight size={17} />
            </a>
          </div>

          <div className={styles.articleGrid}>
            {articles.map((article, index) => {
              const Icon = article.icon;
              return (
                <article className={styles.articleCard} key={article.title}>
                  <a href="#newsletter" aria-label={`${article.title} 읽기`}>
                    <div
                      className={`${styles.articleArtwork} ${styles[article.tone]}`}
                    >
                      <span className={styles.articleNumber}>
                        0{index + 1}
                      </span>
                      <Icon className={styles.articleIcon} size={45} />
                      <span className={styles.articleMiniText}>
                        WELLSET
                        <br />
                        JOURNAL
                      </span>
                    </div>
                    <div className={styles.articleContent}>
                      <div className={styles.articleMeta}>
                        <span>{article.category}</span>
                        <span>
                          <Clock3 size={14} />
                          {article.readTime}
                        </span>
                      </div>
                      <h3>{article.title}</h3>
                      <p>{article.excerpt}</p>
                      <span className={styles.readMore}>
                        읽어보기
                        <ArrowUpRight size={16} />
                      </span>
                    </div>
                  </a>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.manifestoSection} id="about">
          <div className={styles.manifestoArt} aria-hidden="true">
            <div className={styles.manifestoCircle}>
              <MoonStar size={54} />
            </div>
            <p>WELLNESS IS<br />THE NEW WEALTH</p>
            <span className={styles.manifestoLineOne} />
            <span className={styles.manifestoLineTwo} />
          </div>
          <div className={styles.manifestoCopy}>
            <span className={styles.sectionKicker}>OUR PHILOSOPHY</span>
            <h2>
              건강은 소비하는 것이 아니라
              <br />
              <em>쌓아가는 것</em>이니까.
            </h2>
            <p>
              WELLSET은 건강 정보를 읽고 끝내는 곳이 아닙니다. 내 몸의
              신호를 이해하고, 작은 행동을 기록하고, 그 경험을 누군가에게
              도움이 되는 콘텐츠로 만드는 곳이에요.
            </p>
            <p>
              오늘의 좋은 선택이 내일의 체력과 자신감, 그리고 새로운
              기회로 돌아오도록. 함께 건강 자산을 쌓아가요.
            </p>
            <a href="#journey" className={styles.inlineLink}>
              WELLSET의 시작 이야기
              <ArrowRight size={18} />
            </a>
          </div>
        </section>

        <section className={styles.categoriesSection} id="categories">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionKicker}>EXPLORE YOUR INTERESTS</p>
              <h2>지금 나에게 필요한 이야기</h2>
            </div>
          </div>
          <div className={styles.categoryGrid}>
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <a
                  href="#newsletter"
                  className={`${styles.categoryCard} ${styles[category.color]}`}
                  key={category.name}
                >
                  <span className={styles.categoryIcon}>
                    <Icon size={25} />
                  </span>
                  <span className={styles.categoryIndex}>0{categories.indexOf(category) + 1}</span>
                  <h3>{category.name}</h3>
                  <p>{category.description}</p>
                  <ArrowUpRight className={styles.categoryArrow} size={20} />
                </a>
              );
            })}
          </div>
        </section>

        <section className={styles.contentHubSection} id="insights">
          <div className={styles.contentHubIntro}>
            <div>
              <p className={styles.sectionKicker}>WELLSET CONTENT HUB</p>
              <h2>
                찾고 있던 답에서
                <br />
                <em>나만의 건강 자산</em>으로.
              </h2>
            </div>
            <p>
              검색으로 들어와 한 편을 읽고 끝나지 않도록, 생활 속 질문을
              건강 루틴과 콘텐츠 실행으로 연결합니다.
            </p>
          </div>

          <nav className={styles.categoryTabs} aria-label="콘텐츠 카테고리">
            <a href="#guide-health">건강 루틴</a>
            <a href="#guide-beauty">이너뷰티</a>
            <a href="#guide-ai">AI 콘텐츠</a>
            <a href="#guide-income">건강 패시브인컴</a>
            <a href="#guide-marketing">웰니스 마케팅</a>
          </nav>

          <div className={styles.guideGrid}>
            {categoryGuides.map((guide, index) => (
              <article
                id={
                  ["guide-health", "guide-beauty", "guide-ai", "guide-income", "guide-marketing"][
                    index
                  ]
                }
                className={`${styles.guideCard} ${styles[guide.tone]}`}
                key={guide.title}
              >
                <a href="#newsletter" aria-label={`${guide.title} 읽기`}>
                  <div className={styles.guideMeta}>
                    <span>{guide.category}</span>
                    <span>{guide.number}</span>
                  </div>
                  <span className={styles.searchKeyword}>
                    사람들이 찾는 질문 · {guide.keyword}
                  </span>
                  <h3>{guide.title}</h3>
                  <p>{guide.excerpt}</p>
                  <span className={styles.guideLink}>
                    가이드 읽기
                    <ArrowUpRight size={17} />
                  </span>
                </a>
              </article>
            ))}
          </div>

          <div className={styles.leadMagnet}>
            <div className={styles.leadMagnetBadge}>
              <span>FREE</span>
              GUIDE
            </div>
            <div className={styles.leadMagnetCopy}>
              <span>WELLSET STARTER KIT</span>
              <strong>내 경험을 첫 웰니스 콘텐츠로 만드는 10가지 질문</strong>
              <p>주제 찾기부터 검색형 제목, 자연스러운 CTA까지 한 번에 시작하세요.</p>
            </div>
            <a href="#newsletter">
              무료로 받아보기
              <ArrowRight size={18} />
            </a>
          </div>
        </section>

        <section className={styles.journeySection} id="journey">
          <div className={styles.journeyHeader}>
            <p className={styles.sectionKicker}>THE WELLSET JOURNEY</p>
            <h2>
              좋아하는 건강 이야기를
              <br />
              <em>오래 가는 자산</em>으로.
            </h2>
            <p>
              완벽한 전문가가 아니어도 괜찮아요. 나의 실제 경험에서
              출발하는 3단계 여정을 만나보세요.
            </p>
          </div>

          <div className={styles.pathGrid}>
            {pathSteps.map((step, index) => (
              <div className={styles.pathStep} key={step.number}>
                <div className={styles.pathNumber}>{step.number}</div>
                <div className={styles.pathIcon}>
                  {index === 0 && <Salad size={24} />}
                  {index === 1 && <Bot size={24} />}
                  {index === 2 && <TrendingUp size={24} />}
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                {index < pathSteps.length - 1 && (
                  <ArrowRight className={styles.pathArrow} size={22} />
                )}
              </div>
            ))}
          </div>

          <div className={styles.journeyCta}>
            <div>
              <span>FREE STARTER GUIDE</span>
              <strong>내 첫 웰니스 콘텐츠, 오늘 시작해 볼까요?</strong>
            </div>
            <Link href="/signup">
              무료 가이드 받기
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>

        <section className={styles.newsletterSection} id="newsletter">
          <div className={styles.newsletterStamp} aria-hidden="true">
            <span>WELLSET WEEKLY · WELLSET WEEKLY ·</span>
            <Sprout size={34} />
          </div>
          <div className={styles.newsletterContent}>
            <p className={styles.sectionKicker}>A LETTER FOR YOUR WELLNESS</p>
            <h2>
              매주 한 번,
              <br />
              나를 위한 건강한 영감.
            </h2>
            <p>
              읽을수록 삶이 가벼워지는 건강·뷰티 인사이트와 콘텐츠
              아이디어를 이메일로 보내드려요.
            </p>
            <form className={styles.newsletterForm} action="/signup">
              <label className={styles.srOnly} htmlFor="newsletter-email">
                이메일 주소
              </label>
              <input
                id="newsletter-email"
                type="email"
                name="email"
                placeholder="이메일 주소를 입력하세요"
                required
              />
              <button type="submit">
                구독하기
                <ArrowRight size={17} />
              </button>
            </form>
            <small>구독은 언제든 해지할 수 있어요. 스팸은 보내지 않습니다.</small>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div>
            <Link href="/" className={styles.footerLogo}>
              WELLSET<span>.</span>
            </Link>
            <p>
              건강한 오늘을 쌓아
              <br />
              더 나다운 내일을 만듭니다.
            </p>
          </div>
          <div className={styles.footerLinks}>
            <div>
              <strong>EXPLORE</strong>
              <a href="#articles">읽을거리</a>
              <a href="#categories">카테고리</a>
              <a href="#journey">웰셋 시작하기</a>
            </div>
            <div>
              <strong>ACCOUNT</strong>
              <Link href="/login">로그인</Link>
              <Link href="/signup">무료 회원가입</Link>
              <Link href="/health-check">건강 체크</Link>
            </div>
            <div>
              <strong>FOLLOW</strong>
              <a href="#newsletter">Instagram</a>
              <a href="#newsletter">YouTube</a>
              <a href="#newsletter">Threads</a>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© 2026 WELLSET. All rights reserved.</span>
          <span>
            본 콘텐츠는 일반적인 건강 정보이며 의학적 진단을 대신하지
            않습니다.
          </span>
        </div>
      </footer>
    </div>
  );
}
