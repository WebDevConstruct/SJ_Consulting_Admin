export function StatCard({label,value,detail,accent=false}:
    {label:string;value:string;detail:string;accent?:boolean}){
    return (
    <article className={`rounded-3xl border p-5 ${accent?"border-gold-300 bg-ink text-paper":"border-paper-line bg-paper dark:border-ink-line dark:bg-ink-surface"}`}
    ><p className={`text-xs uppercase tracking-[.16em] ${accent?"text-gold-200":"text-black/45 dark:text-white/45"}`}>
        {label}
        </p>
        <p 
        className="mt-5 font-display text-4xl tracking-tightest">
            {value}
            </p>
            <p className={`mt-2 text-sm ${accent?"text-white/60":"text-black/50 dark:text-white/55"}`}>
            {detail}
            </p>
            </article>
            )}
