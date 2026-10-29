/* Shared state: who you are (me), which game is open (G), the current phase,
   your online rival (opp, on) and the rematch counter (myG). */
let me={n:'',ch:0},cpu=false,lostAt=0,G='brawl',myG=0,mh='',oh='',S=null,rounds=0,phase='menu',sel=null,busy=false,opp=null,oc=1,on='Rival',code='',ac;
