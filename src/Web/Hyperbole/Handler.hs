{-# LANGUAGE AllowAmbiguousTypes #-}

module Web.Hyperbole.Handler
  ( Page (..)
  , page
  , load
  , Hyperbole (..)
  , Handler (..)
  , Handlers (..)
  )
where

import Data.Kind (Type)
import Effectful
import Effectful.Dispatch.Dynamic
import Web.Hyperbole.Effect.Hyperbole
import Web.Hyperbole.Effect.Server
import Web.Hyperbole.HyperView
import Web.Hyperbole.View.Target (hyperUnsafe)
import Web.View


-- class Handle (views :: [Type]) where
--   type Handlers (es :: [Effect]) views :: Type
--   runHandlers :: (Hyperbole :> es) => Handlers es views -> Eff es ()

class (HyperView view) => Handler view es where
  handle :: (Hyperbole :> es) => view -> Action view -> Eff es (View view ())


class Handlers (views :: [Type]) es where
  runHandlers :: (Hyperbole :> es) => Eff es ()


instance Handlers '[] es where
  runHandlers = pure ()


instance (HyperView view, Handler view es, Handlers views es) => Handlers (view : views) es where
  runHandlers = do
    runHandler @view (handle @view)
    runHandlers @views


-- handle
--   :: forall views es
--    . (Handle (TupleList views), Hyperbole :> es)
--   => Handlers es (TupleList views)
--   -> Eff es (View (Root (TupleList views)) ())
--   -> Page es views
-- handle handlers loadPage = Page $ do
--   runHandlers @(TupleList views) handlers
--   guardNoEvent
--   loadPage

runHandler
  :: forall id es
   . (HyperView id, Hyperbole :> es)
  => (id -> Action id -> Eff es (View id ()))
  -> Eff es ()
runHandler run = do
  -- Get an event matching our type. If it doesn't match, skip to the next handler
  mev <- getEvent @id :: Eff es (Maybe (Event id (Action id)))
  case mev of
    Just event -> do
      vw <- run event.viewId event.action
      let vid = TargetViewId $ toViewId event.viewId
      send $ RespondEarly $ Response vid $ hyperUnsafe event.viewId vw
    _ -> do
      pure ()


guardNoEvent :: (Hyperbole :> es) => Eff es ()
guardNoEvent = do
  r <- request
  case lookupEvent r.query of
    -- Are id and action set to something?
    Just e -> send $ RespondEarly $ Err $ ErrNotHandled e
    Nothing -> pure ()


-- deriving newtype (Applicative, Monad, Functor)

{- | The load handler is run when the page is first loaded. Run any side effects needed, then return a view of the full page

@
myPage :: (Hyperbole :> es) => UserId -> Page es Response
myPage userId = do
  'load' $ do
    user <- loadUserFromDatabase userId
    pure $ userPageView user
@
-}

-- load
--   :: (Hyperbole :> es)
--   => Eff es (View (Root views) ())
--   -> Page views es Response
-- load run = Page $ do
--   r <- request
--   case lookupEvent r.query of
--     -- Are id and action set to sometjhing?
--     Just e ->
--       pure $ Err $ ErrNotHandled e
--     Nothing -> do
--       vw <- run
--       view vw

{- | A handler is run when an action for that 'HyperView' is triggered. Run any side effects needed, then return a view of the corresponding type

@
myPage :: ('Hyperbole' :> es) => 'Page' es 'Response'
myPage = do
  'handle' messages
  'load' pageView

messages :: ('Hyperbole' :> es, MessageDatabase) => Message -> MessageAction -> 'Eff' es ('View' Message ())
messages (Message mid) ClearMessage = do
  deleteMessageSideEffect mid
  pure $ messageView ""

messages (Message mid) (Louder m) = do
  let new = m <> "!"
  saveMessageSideEffect mid new
  pure $ messageView new
@
-}

{- | Hyperbole applications are divided into Pages. Each Page must 'load' the whole page , and 'handle' each /type/ of 'HyperView'

@
myPage :: ('Hyperbole' :> es) => 'Page' es 'Response'
myPage = do
  'handle' messages
  'load' pageView

pageView = do
  el_ "My Page"
  'hyper' (Message 1) $ messageView "Starting Message"
@
-}
type Page (es :: [Effect]) (views :: [Type]) = Eff es (View (Root views) ())


-- | Run a 'Page' in 'Hyperbole'
page
  :: forall views es
   . (Hyperbole :> es, Handlers views es)
  => Page es views
  -> Eff es Response
page loadPage = do
  runHandlers @views
  guardNoEvent
  loadToResponse loadPage


loadToResponse :: Eff es (View (Root total) ()) -> Eff es Response
loadToResponse run = do
  vw <- run
  let vid = TargetViewId (toViewId Root)
  let res = Response vid $ addContext Root vw
  pure res


load :: (Hyperbole :> es, Handlers views es) => Eff es (View (Root views) ()) -> Page es views
load runLoad = runLoad
